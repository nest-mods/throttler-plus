import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request, { type Response } from 'supertest';

import { AppModule } from '../src/app.module';
import {
  clearTrackerObservations,
  HTTP_SCENARIO_NAMES,
  type HttpScenarioName,
  type TrackerObservation,
  trackerObservations,
} from '../src/scenario-observations';

interface ScenarioRequest {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  method: 'get' | 'post';
  path: string;
  query?: Record<string, string>;
}

interface ScenarioFixture extends ScenarioRequest {
  limit: number;
  observation?: TrackerObservation;
  scenario: HttpScenarioName;
  ttlSeconds: number;
}

interface IndependenceFixture {
  expectedObservations: TrackerObservation[];
  expectedRemaining: number;
  first: ScenarioRequest;
  scenario: HttpScenarioName;
  second: ScenarioRequest;
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function fixtureUser(uid: string, id = uid): string {
  return JSON.stringify({ id, uid });
}

const scenarioFixtures: ScenarioFixture[] = [
  {
    scenario: 'method-path',
    method: 'get',
    path: '/scenarios/method-path',
    limit: 30,
    ttlSeconds: 60,
    observation: {
      scenario: 'method-path',
      value: 'GET:/scenarios/method-path',
    },
  },
  {
    scenario: 'class-default',
    method: 'get',
    path: '/scenarios/class-default',
    limit: 30,
    ttlSeconds: 60,
  },
  {
    scenario: 'method-default',
    method: 'get',
    path: '/scenarios/method-default',
    limit: 10,
    ttlSeconds: 60,
  },
  {
    scenario: 'payload-hash',
    method: 'post',
    path: '/scenarios/payload-hash',
    body: {
      category: null,
      quantity: 2,
      subjectId: 'subject-a',
      userId: 'user-a',
    },
    limit: 1,
    ttlSeconds: 10,
    observation: {
      scenario: 'payload-hash',
      value: `user-a_${
        md5(JSON.stringify({ subjectId: 'subject-a', quantity: 2 }))
      }`,
    },
  },
  {
    scenario: 'user-ip',
    method: 'get',
    path: '/scenarios/user-ip',
    headers: { 'x-fixture-user': fixtureUser('uid-a', 'id-a') },
    limit: 60,
    ttlSeconds: 60,
    observation: { scenario: 'user-ip', value: 'uid-a' },
  },
  {
    scenario: 'email-source',
    method: 'post',
    path: '/scenarios/email-source',
    query: { email: 'query@example.test' },
    body: { email: 'body@example.test' },
    limit: 1000,
    ttlSeconds: 3600,
    observation: {
      scenario: 'email-source',
      value: 'query@example.test',
    },
  },
  {
    scenario: 'username',
    method: 'post',
    path: '/scenarios/username',
    body: { username: 'name-a' },
    limit: 1000,
    ttlSeconds: 3600,
    observation: { scenario: 'username', value: 'name-a' },
  },
  {
    scenario: 'email-ip',
    method: 'post',
    path: '/scenarios/email-ip',
    body: { email: 'first@example.test' },
    limit: 1,
    ttlSeconds: 10,
    observation: { scenario: 'email-ip', value: 'first@example.test' },
  },
  {
    scenario: 'path-hash',
    method: 'post',
    path: '/scenarios/path-hash',
    body: { userId: 'user-a' },
    limit: 2,
    ttlSeconds: 60,
    observation: {
      scenario: 'path-hash',
      value: `user-a_${md5(JSON.stringify({ path: '/scenarios/path-hash' }))}`,
    },
  },
  {
    scenario: 'composed-header',
    method: 'get',
    path: '/scenarios/composed-header',
    headers: {
      'x-client-key': 'client-a',
      'x-fixture-user': fixtureUser('uid-a', 'id-a'),
    },
    limit: 2,
    ttlSeconds: 1,
    observation: { scenario: 'composed-header', value: 'client-a' },
  },
];

const independenceFixtures: IndependenceFixture[] = [
  {
    scenario: 'username',
    first: {
      method: 'post',
      path: '/scenarios/username',
      body: { username: 'name-a' },
    },
    second: {
      method: 'post',
      path: '/scenarios/username',
      body: { username: 'name-b' },
    },
    expectedRemaining: 999,
    expectedObservations: [
      { scenario: 'username', value: 'name-a' },
      { scenario: 'username', value: 'name-b' },
    ],
  },
  {
    scenario: 'email-source',
    first: {
      method: 'post',
      path: '/scenarios/email-source',
      query: { email: 'query@example.test' },
      body: { email: 'ignored@example.test' },
    },
    second: {
      method: 'post',
      path: '/scenarios/email-source',
      body: { email: 'body@example.test' },
    },
    expectedRemaining: 999,
    expectedObservations: [
      { scenario: 'email-source', value: 'query@example.test' },
      { scenario: 'email-source', value: 'body@example.test' },
    ],
  },
  {
    scenario: 'email-ip',
    first: {
      method: 'post',
      path: '/scenarios/email-ip',
      body: { email: 'first@example.test' },
    },
    second: {
      method: 'post',
      path: '/scenarios/email-ip',
      body: { email: 'second@example.test' },
    },
    expectedRemaining: 0,
    expectedObservations: [
      { scenario: 'email-ip', value: 'first@example.test' },
      { scenario: 'email-ip', value: 'second@example.test' },
    ],
  },
  {
    scenario: 'user-ip',
    first: {
      method: 'get',
      path: '/scenarios/user-ip',
      headers: { 'x-fixture-user': fixtureUser('uid-a', 'id-a') },
    },
    second: {
      method: 'get',
      path: '/scenarios/user-ip',
      headers: { 'x-fixture-user': fixtureUser('uid-b', 'id-b') },
    },
    expectedRemaining: 59,
    expectedObservations: [
      { scenario: 'user-ip', value: 'uid-a' },
      { scenario: 'user-ip', value: 'uid-b' },
    ],
  },
  {
    scenario: 'composed-header',
    first: {
      method: 'get',
      path: '/scenarios/composed-header',
      headers: {
        'x-client-key': 'client-a',
        'x-fixture-user': fixtureUser('uid-a', 'id-a'),
      },
    },
    second: {
      method: 'get',
      path: '/scenarios/composed-header',
      headers: {
        'x-client-key': 'client-b',
        'x-fixture-user': fixtureUser('uid-a', 'id-a'),
      },
    },
    expectedRemaining: 1,
    expectedObservations: [
      { scenario: 'composed-header', value: 'client-a' },
      { scenario: 'composed-header', value: 'client-b' },
    ],
  },
  {
    scenario: 'payload-hash',
    first: {
      method: 'post',
      path: '/scenarios/payload-hash',
      body: { quantity: 1, subjectId: 'subject-a', userId: 'user-a' },
    },
    second: {
      method: 'post',
      path: '/scenarios/payload-hash',
      body: { quantity: 2, subjectId: 'subject-a', userId: 'user-a' },
    },
    expectedRemaining: 0,
    expectedObservations: [
      {
        scenario: 'payload-hash',
        value: `user-a_${
          md5(JSON.stringify({ subjectId: 'subject-a', quantity: 1 }))
        }`,
      },
      {
        scenario: 'payload-hash',
        value: `user-a_${
          md5(JSON.stringify({ subjectId: 'subject-a', quantity: 2 }))
        }`,
      },
    ],
  },
  {
    scenario: 'path-hash',
    first: {
      method: 'post',
      path: '/scenarios/path-hash',
      body: { userId: 'user-a' },
    },
    second: {
      method: 'post',
      path: '/scenarios/path-hash/alternate',
      body: { userId: 'user-a' },
    },
    expectedRemaining: 1,
    expectedObservations: [
      {
        scenario: 'path-hash',
        value: `user-a_${
          md5(JSON.stringify({ path: '/scenarios/path-hash' }))
        }`,
      },
      {
        scenario: 'path-hash',
        value: `user-a_${
          md5(JSON.stringify({ path: '/scenarios/path-hash/alternate' }))
        }`,
      },
    ],
  },
];

async function send(
  app: INestApplication,
  fixture: ScenarioRequest,
): Promise<Response> {
  let pending = fixture.method === 'get'
    ? request(app.getHttpServer()).get(fixture.path)
    : request(app.getHttpServer()).post(fixture.path);

  for (const [name, value] of Object.entries(fixture.headers ?? {})) {
    pending = pending.set(name, value);
  }
  if (fixture.query) {
    pending = pending.query(fixture.query);
  }
  if (fixture.body) {
    pending = pending.send(fixture.body);
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

describe('HTTP throttling scenarios', () => {
  let app: INestApplication | undefined;

  beforeEach(async () => {
    clearTrackerObservations();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      app = undefined;
      clearTrackerObservations();
    }
  });

  it('keeps the scenario registry and transport table one-to-one', () => {
    const fixtureNames = scenarioFixtures.map(({ scenario }) => scenario);

    expect(fixtureNames).toEqual(HTTP_SCENARIO_NAMES);
    expect(new Set(fixtureNames).size).toBe(fixtureNames.length);
  });

  it.each(scenarioFixtures)(
    '$scenario returns its configured rate-limit headers',
    async (fixture) => {
      const response = await send(app!, fixture);

      expect(response.status).toBe(200);
      expectRateLimitHeaders(response, fixture.limit, fixture.ttlSeconds);
      expect(trackerObservations).toEqual(
        fixture.observation ? [fixture.observation] : [],
      );
    },
  );

  it.each([
    scenarioFixtures.find(({ scenario }) => scenario === 'payload-hash')!,
    scenarioFixtures.find(({ scenario }) => scenario === 'email-ip')!,
  ])('$scenario rejects a repeated limit-one key', async (fixture) => {
    expect((await send(app!, fixture)).status).toBe(200);
    expect((await send(app!, fixture)).status).toBe(429);
    expect(trackerObservations).toEqual([
      fixture.observation,
      fixture.observation,
    ]);
  });

  it('composed-header rejects the third repeated key', async () => {
    const fixture = scenarioFixtures.find(
      ({ scenario }) => scenario === 'composed-header',
    )!;

    expect((await send(app!, fixture)).status).toBe(200);
    expect((await send(app!, fixture)).status).toBe(200);
    expect((await send(app!, fixture)).status).toBe(429);
    expect(trackerObservations).toEqual([
      fixture.observation,
      fixture.observation,
      fixture.observation,
    ]);
  });

  it.each(independenceFixtures)(
    '$scenario keeps changed tracker inputs independent',
    async ({ expectedObservations, expectedRemaining, first, second }) => {
      const firstResponse = await send(app!, first);
      const secondResponse = await send(app!, second);

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstResponse.headers['x-ratelimit-remaining']).toBe(
        String(expectedRemaining),
      );
      expect(secondResponse.headers['x-ratelimit-remaining']).toBe(
        String(expectedRemaining),
      );
      expect(trackerObservations).toEqual(expectedObservations);
    },
  );
});
