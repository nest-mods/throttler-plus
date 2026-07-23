import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  Controller,
  Get,
  type INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import {
  ThrottlerGuard,
  type ThrottlerRequest,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';

let graphqlModuleLoads = 0;

jest.unstable_mockModule('@nestjs/graphql', () => {
  graphqlModuleLoads += 1;
  return jest.requireActual('@nestjs/graphql');
});

const { ThrottlerPlusGuard, ThrottlerPlusModule } = await import('./index.ts');

@Controller('guard-probe')
@UseGuards(ThrottlerPlusGuard)
class GuardProbeController {
  @Get()
  probe(): string {
    return 'ok';
  }
}

class GuardHarness extends ThrottlerPlusGuard {
  invokeHandleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return this.handleRequest(requestProps);
  }
}

describe('ThrottlerPlusGuard', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('is injectable and preserves upstream HTTP throttling behavior', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({
          throttler: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
      ],
      controllers: [GuardProbeController],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();

    expect(testingModule.get(ThrottlerPlusGuard)).toBeInstanceOf(
      ThrottlerGuard,
    );
    await request(app.getHttpServer()).get('/guard-probe').expect(200, 'ok');
    await request(app.getHttpServer()).get('/guard-probe').expect(429);
    expect(graphqlModuleLoads).toBe(0);
  });

  it('extracts req and res from a GraphQL context', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new GuardHarness(
      [{ name: 'default', limit: 10, ttl: 60_000 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const gqlRequest = { headers: {}, ip: 'graphql-client' };
    const gqlResponseHeaders = new Map<string, number>();
    const gqlResponse = {
      header(name: string, value: number): void {
        gqlResponseHeaders.set(name, value);
      },
    };
    const httpFallbackRequest = { headers: {}, ip: 'http-fallback' };
    const httpFallbackResponse = { header(): void {} };
    const context = new ExecutionContextHost([
      httpFallbackRequest,
      httpFallbackResponse,
      { req: gqlRequest, res: gqlResponse },
      {},
    ]);
    context.setType('graphql');
    let trackedRequest: unknown;

    await guard.invokeHandleRequest({
      context,
      limit: 10,
      ttl: 60_000,
      throttler: { name: 'default', limit: 10, ttl: 60_000 },
      blockDuration: 60_000,
      getTracker: (req) => {
        trackedRequest = req;
        return req.ip;
      },
      generateKey: (_context, tracker) => tracker,
    });
    storage.onApplicationShutdown();

    expect(trackedRequest).toBe(gqlRequest);
    expect(gqlResponseHeaders.size).toBe(3);
  });

  it('falls back to req.res for a GraphQL response', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new GuardHarness(
      [{ name: 'default', limit: 10, ttl: 60_000 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const gqlResponseHeaders = new Map<string, number>();
    const gqlResponse = {
      header(name: string, value: number): void {
        gqlResponseHeaders.set(name, value);
      },
    };
    const gqlRequest = {
      headers: {},
      ip: 'graphql-client-with-response',
      res: gqlResponse,
    };
    const context = new ExecutionContextHost([
      { headers: {}, ip: 'http-fallback' },
      { header(): void {} },
      { req: gqlRequest },
      {},
    ]);
    context.setType('graphql');
    let trackedRequest: unknown;

    await guard.invokeHandleRequest({
      context,
      limit: 10,
      ttl: 60_000,
      throttler: { name: 'default', limit: 10, ttl: 60_000 },
      blockDuration: 60_000,
      getTracker: (req) => {
        trackedRequest = req;
        return req.ip;
      },
      generateKey: (_context, tracker) => tracker,
    });
    storage.onApplicationShutdown();

    expect(trackedRequest).toBe(gqlRequest);
    expect(gqlResponseHeaders.size).toBe(3);
  });

  it('resolves the GraphQL module once for concurrent handling', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new GuardHarness(
      [{ name: 'default', limit: 10, ttl: 60_000 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const createRequestProps = (ip: string): ThrottlerRequest => {
      const req = { headers: {}, ip };
      const context = new ExecutionContextHost([
        { headers: {}, ip: `http-fallback-${ip}` },
        { header(): void {} },
        { req, res: { header(): void {} } },
        {},
      ]);
      context.setType('graphql');

      return {
        context,
        limit: 10,
        ttl: 60_000,
        throttler: { name: 'default', limit: 10, ttl: 60_000 },
        blockDuration: 60_000,
        getTracker: (request) => request.ip,
        generateKey: (_context, tracker) => tracker,
      };
    };

    await Promise.all([
      guard.invokeHandleRequest(createRequestProps('first')),
      guard.invokeHandleRequest(createRequestProps('second')),
    ]);
    storage.onApplicationShutdown();

    expect(graphqlModuleLoads).toBe(1);
  });
});
