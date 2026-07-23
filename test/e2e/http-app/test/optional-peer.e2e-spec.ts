import { afterEach, describe, expect, it } from '@jest/globals';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import {
  ThrottlerPlusGuard,
  ThrottlerPlusModule,
} from '@nest-mods/throttler-plus';

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
      imports: [ThrottlerPlusModule.forRoot()],
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
    expect((rejection as Error & { cause?: unknown }).cause).toBeInstanceOf(
      Error,
    );
  });
});
