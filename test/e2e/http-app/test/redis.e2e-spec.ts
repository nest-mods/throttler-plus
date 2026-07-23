import { afterEach, describe, expect, it } from '@jest/globals';
import {
  Controller,
  DynamicModule,
  Get,
  INestApplication,
  Module,
  Type,
} from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { ThrottlerPlusModule, UseThrottler } from '@nest-mods/throttler-plus';
import {
  clearTrackerObservations,
  observeTracker,
  trackerObservations,
} from '../src/scenario-observations';

interface RedisFixtureOptions {
  host: string;
  keyPrefix: string;
  port: number;
}

const REDIS_FIXTURE_OPTIONS = Symbol('REDIS_FIXTURE_OPTIONS');

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the Redis e2e scenarios.`);
  }
  return value;
}

function redisEnvironment(keyPrefix: string): RedisFixtureOptions {
  const portText = requiredEnvironment('E2E_REDIS_PORT');
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `E2E_REDIS_PORT must be a positive integer, got ${portText}.`,
    );
  }

  return {
    host: requiredEnvironment('E2E_REDIS_HOST'),
    keyPrefix,
    port,
  };
}

@Module({})
class RedisFixtureConfigModule {
  static register(options: RedisFixtureOptions): DynamicModule {
    return {
      module: RedisFixtureConfigModule,
      providers: [{ provide: REDIS_FIXTURE_OPTIONS, useValue: options }],
      exports: [REDIS_FIXTURE_OPTIONS],
    };
  }
}

function redisTracker(requestRecord: Record<string, unknown>): string {
  const headers = requestRecord.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const value = String(headers?.['x-fixture-key'] ?? '');
  return observeTracker('redis-shared', value);
}

@Controller('redis-scenario')
class RedisScenarioController {
  @Get()
  @UseThrottler({ getTracker: redisTracker, limit: 1, ttl: '10s' })
  run(): { scenario: string } {
    return { scenario: 'redis-shared' };
  }
}

function createRedisAppModule(options: RedisFixtureOptions): Type<unknown> {
  const configModule = RedisFixtureConfigModule.register(options);

  @Module({
    imports: [
      ThrottlerPlusModule.forRootAsync({
        imports: [configModule],
        inject: [REDIS_FIXTURE_OPTIONS],
        useFactory: (fixtureOptions: RedisFixtureOptions) => ({
          redis: {
            connectTimeout: 5_000,
            host: fixtureOptions.host,
            keyPrefix: fixtureOptions.keyPrefix,
            maxRetriesPerRequest: 1,
            port: fixtureOptions.port,
          },
        }),
      }),
    ],
    controllers: [RedisScenarioController],
  })
  class RedisAppModule {}

  return RedisAppModule;
}

async function createRedisApp(
  options: RedisFixtureOptions,
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [createRedisAppModule(options)],
  }).compile();
  const app = moduleFixture.createNestApplication();
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function closeApps(apps: INestApplication[]): Promise<void> {
  for (const app of apps.reverse()) {
    await app.close();
  }
}

describe('Redis-backed HTTP throttling', () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    try {
      await closeApps(apps);
    } finally {
      apps.length = 0;
      clearTrackerObservations();
    }
  });

  it('shares a supplied prefix and isolates plain and hash-tag prefixes', async () => {
    const suppliedPrefix = requiredEnvironment('E2E_REDIS_KEY_PREFIX');
    const prefixes = [
      suppliedPrefix,
      'fixture-plain:',
      '{group-a}:',
      '{group-b}:',
    ];
    const key = randomUUID();

    for (
      const keyPrefix of [suppliedPrefix, suppliedPrefix, ...prefixes.slice(1)]
    ) {
      const app = await createRedisApp(redisEnvironment(keyPrefix));
      apps.push(app);
    }

    const statuses: number[] = [];
    for (const app of apps) {
      const response = await request(app.getHttpServer())
        .get('/redis-scenario')
        .set('x-fixture-key', key);
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 429, 200, 200, 200]);
    expect(trackerObservations).toEqual(
      Array.from({ length: 5 }, () => ({
        scenario: 'redis-shared',
        value: key,
      })),
    );
  });

  it('rejects Redis combined with real upstream memory storage', async () => {
    const configModule = RedisFixtureConfigModule.register(
      redisEnvironment(requiredEnvironment('E2E_REDIS_KEY_PREFIX')),
    );
    const dynamicModule = ThrottlerPlusModule.forRootAsync({
      imports: [configModule],
      inject: [REDIS_FIXTURE_OPTIONS],
      useFactory: (fixtureOptions: RedisFixtureOptions) => ({
        redis: fixtureOptions,
        throttler: { storage: new ThrottlerStorageService() },
      }),
    });

    await expect(
      Test.createTestingModule({ imports: [dynamicModule] }).compile(),
    ).rejects.toThrow(
      'Cannot configure both "redis" and "throttler.storage".',
    );
  });
});
