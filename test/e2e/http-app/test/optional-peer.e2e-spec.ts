import { afterEach, describe, expect, it } from '@jest/globals';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import {
  ThrottlerPlusGuard,
  ThrottlerPlusModule,
} from '@nest-mods/throttler-plus';
import { createIsolatedRedisOptions } from '../src/redis-fixture';

class ContextTarget {
  handle(): void {}
}

describe('HTTP-only optional peer boundary', () => {
  let moduleFixture: TestingModule | undefined;

  afterEach(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
      moduleFixture = undefined;
    }
  });

  it('preserves the module-loading cause when GraphQL peers are absent', async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRootAsync({
          useFactory: () => ({ redis: createIsolatedRedisOptions() }),
        }),
      ],
    }).compile();
    await moduleFixture.init();
    const guard = moduleFixture.get(ThrottlerPlusGuard);
    const context = new ExecutionContextHost(
      [{}, {}],
      ContextTarget,
      ContextTarget.prototype.handle,
    );
    context.setType('graphql');

    let rejection: unknown;
    try {
      await guard.canActivate(context);
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe(
      'GraphQL throttling requires both optional peers "@nestjs/graphql" and "graphql". Install both packages before handling GraphQL requests.',
    );
    const cause = (rejection as Error & { cause?: unknown }).cause;
    expect(cause).toEqual(
      expect.objectContaining({ code: 'MODULE_NOT_FOUND' }),
    );
    expect((cause as { message?: unknown }).message).toEqual(
      expect.stringContaining('@nestjs/graphql'),
    );
  });
});
