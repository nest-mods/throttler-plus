import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';

import { AppModule } from '../src/app.module';
import {
  GRAPHQL_SCENARIOS,
  type GraphqlScenario,
  type GraphqlScenarioId,
} from '../src/scenario-registry';

interface GraphqlErrorBody {
  message: string;
}

interface GraphqlResponseBody {
  data: Record<string, unknown> | null;
  errors?: GraphqlErrorBody[];
}

interface IntrospectionResponseBody {
  data: {
    __schema: {
      queryType: {
        fields: Array<{ name: string }>;
      };
    };
  };
}

function scenarioById(id: GraphqlScenarioId): GraphqlScenario {
  const scenario = GRAPHQL_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Missing GraphQL scenario: ${id}`);
  }
  return scenario;
}

function responseBody(response: Response): GraphqlResponseBody {
  return response.body as GraphqlResponseBody;
}

async function sendOperation(
  app: INestApplication,
  field: string,
  uid?: string,
): Promise<Response> {
  let pending = request(app.getHttpServer())
    .post('/graphql')
    .send({ query: `query { ${field} }` });

  if (uid) {
    pending = pending.set('x-fixture-user', uid);
  }

  return await pending;
}

function expectRateLimitHeaders(
  response: Response,
  limit: number,
  ttlSeconds: number,
): void {
  expect(response.headers['x-ratelimit-limit']).toBe(String(limit));

  const reset = Number(response.headers['x-ratelimit-reset']);
  expect(reset).toBeGreaterThan(0);
  expect(reset).toBeLessThanOrEqual(ttlSeconds);
  expect(reset).toBeGreaterThanOrEqual(ttlSeconds - 1);
}

function expectSuccess(
  response: Response,
  field: string,
  limit: number,
  ttlSeconds: number,
): void {
  expect(response.status).toBe(200);
  expect(responseBody(response)).toEqual({
    data: { [field]: field },
  });
  expectRateLimitHeaders(response, limit, ttlSeconds);
}

function expectThrottled(response: Response, ttlSeconds: number): void {
  const body = responseBody(response);

  expect(response.status).toBe(200);
  expect(body.data).toBeNull();
  expect(body.errors).toBeDefined();
  expect(body.errors?.length).toBeGreaterThan(0);
  expect(
    body.errors?.some(({ message }) => message.includes('Too Many Requests')),
  ).toBe(true);

  const retryAfter = Number(response.headers['retry-after']);
  expect(retryAfter).toBeGreaterThan(0);
  expect(retryAfter).toBeLessThanOrEqual(ttlSeconds);
  expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  expect(response.headers['x-ratelimit-reset']).toBeUndefined();
}

describe('Redis-backed GraphQL throttling', () => {
  let app: INestApplication | undefined;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();

    try {
      await app.init();
    } catch (error) {
      await app.close();
      app = undefined;
      throw error;
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('maps the seven capabilities to every public query field', async () => {
    const response = await request(app!.getHttpServer())
      .post('/graphql')
      .send({
        query: '{ __schema { queryType { fields { name } } } }',
      });
    const body = response.body as IntrospectionResponseBody;
    const publicFields = body.data.__schema.queryType.fields
      .map(({ name }) => name)
      .filter((name) => !name.startsWith('_'))
      .sort();
    const registeredFields = GRAPHQL_SCENARIOS
      .flatMap(({ fields }) => fields)
      .sort();
    const scenarioIds = GRAPHQL_SCENARIOS.map(({ id }) => id);

    expect(response.status).toBe(200);
    expect(GRAPHQL_SCENARIOS).toHaveLength(7);
    expect(new Set(scenarioIds).size).toBe(7);
    expect(registeredFields).toHaveLength(8);
    expect(new Set(registeredFields).size).toBe(8);
    expect(publicFields).toEqual(registeredFields);
  });

  it.each(GRAPHQL_SCENARIOS)(
    '$id returns its configured data and rate-limit headers',
    async (scenario) => {
      const field = scenario.fields[0];
      const response = await sendOperation(
        app!,
        field,
        scenario.tracker === 'uid' ? 'uid-a' : undefined,
      );

      expectSuccess(
        response,
        field,
        scenario.limit,
        scenario.ttlSeconds,
      );
    },
  );

  it('isolates two method handlers for the same client IP', async () => {
    const scenario = scenarioById('method-default');
    const [firstField, secondField] = scenario.fields;
    if (!secondField) {
      throw new Error('method-default requires two registered fields.');
    }

    const first = await sendOperation(app!, firstField);
    const second = await sendOperation(app!, secondField);

    expectSuccess(first, firstField, scenario.limit, scenario.ttlSeconds);
    expectSuccess(second, secondField, scenario.limit, scenario.ttlSeconds);
  });

  it.each([
    scenarioById('method-default'),
    scenarioById('minute-window'),
  ])('$id returns Apollo execution errors when repeated', async (scenario) => {
    const field = scenario.fields[0];

    const first = await sendOperation(app!, field);
    const repeated = await sendOperation(app!, field);

    expectSuccess(first, field, scenario.limit, scenario.ttlSeconds);
    expectThrottled(repeated, scenario.ttlSeconds);
  });

  it.each([
    scenarioById('user-short'),
    scenarioById('user-three-seconds'),
  ])('$id partitions counters by fixture uid', async (scenario) => {
    const field = scenario.fields[0];

    const first = await sendOperation(app!, field, 'uid-a');
    const repeated = await sendOperation(app!, field, 'uid-a');
    const changed = await sendOperation(app!, field, 'uid-b');

    expectSuccess(first, field, scenario.limit, scenario.ttlSeconds);
    expectThrottled(repeated, scenario.ttlSeconds);
    expectSuccess(changed, field, scenario.limit, scenario.ttlSeconds);
  });
});
