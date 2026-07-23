import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import ms from 'ms';

import { ThrottlerPlusGuard } from './throttler-plus.guard.ts';
import type { UseThrottlerOptions } from './use-throttler-options.interface.ts';

export function UseThrottler(
  options: UseThrottlerOptions = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(ThrottlerPlusGuard),
    Throttle({
      default: {
        limit: options.limit,
        ttl: options.ttl === undefined ? undefined : ms(options.ttl),
        getTracker: options.getTracker,
        generateKey: options.generateKey,
      },
    }),
  );
}
