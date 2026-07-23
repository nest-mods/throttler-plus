import { describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import {
  type ThrottlerRequest,
  ThrottlerStorageService,
} from '@nestjs/throttler';

const optionalPeerLoadFailure = new Error('simulated missing optional peer');

jest.unstable_mockModule('@nestjs/graphql', () => {
  throw optionalPeerLoadFailure;
});

const { ThrottlerPlusGuard } = await import('./throttler-plus.guard.ts');

class GuardHarness extends ThrottlerPlusGuard {
  invokeHandleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return this.handleRequest(requestProps);
  }
}

describe('ThrottlerPlusGuard missing GraphQL peers', () => {
  it('instructs installing both optional peers and preserves the cause', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new GuardHarness(
      [{ name: 'default', limit: 10, ttl: 60_000 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();

    const context = new ExecutionContextHost([{}, {}, {}, {}]);
    context.setType('graphql');
    const requestProps: ThrottlerRequest = {
      context,
      limit: 10,
      ttl: 60_000,
      throttler: { name: 'default', limit: 10, ttl: 60_000 },
      blockDuration: 60_000,
      getTracker: () => 'client',
      generateKey: () => 'key',
    };

    const error = await guard.invokeHandleRequest(requestProps).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    storage.onApplicationShutdown();

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw new TypeError('Expected GraphQL loading to reject with an Error.');
    }
    expect(error.message).toContain('Install');
    expect(error.message).toContain('@nestjs/graphql');
    expect(error.message).toContain('graphql');
    expect(error.cause).toBe(optionalPeerLoadFailure);
  });
});
