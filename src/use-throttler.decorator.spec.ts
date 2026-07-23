import { describe, expect, it } from '@jest/globals';
import { applyDecorators } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import type {
  ThrottlerGenerateKeyFunction,
  ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';

import {
  ThrottlerPlusGuard,
  UseThrottler,
  type UseThrottlerOptions,
} from './index.ts';

const metadataKeys = {
  generateKey: 'THROTTLER:KEY_GENERATORdefault',
  limit: 'THROTTLER:LIMITdefault',
  tracker: 'THROTTLER:TRACKERdefault',
  ttl: 'THROTTLER:TTLdefault',
};

describe('UseThrottler', () => {
  it('composes the guard and explicit undefined fallback metadata', () => {
    @UseThrottler()
    class DefaultTarget {}

    expect(Reflect.getMetadata(GUARDS_METADATA, DefaultTarget)).toEqual([
      ThrottlerPlusGuard,
    ]);
    for (const key of Object.values(metadataKeys)) {
      expect(Reflect.hasOwnMetadata(key, DefaultTarget)).toBe(true);
      expect(Reflect.getOwnMetadata(key, DefaultTarget)).toBeUndefined();
    }
  });

  it('converts and forwards all options on a method', () => {
    const getTracker: ThrottlerGetTrackerFunction = (request) =>
      String(request.userId);
    const generateKey: ThrottlerGenerateKeyFunction = (
      _context,
      tracker,
      name,
    ) => `${name}:${tracker}`;
    const options: UseThrottlerOptions = {
      limit: 7,
      ttl: '2m',
      getTracker,
      generateKey,
    };

    class MethodTarget {
      @UseThrottler(options)
      run(): void {}
    }

    const target = MethodTarget.prototype.run;
    expect(Reflect.getMetadata(GUARDS_METADATA, target)).toEqual([
      ThrottlerPlusGuard,
    ]);
    expect(Reflect.getMetadata(metadataKeys.limit, target)).toBe(7);
    expect(Reflect.getMetadata(metadataKeys.ttl, target)).toBe(120_000);
    expect(Reflect.getMetadata(metadataKeys.tracker, target)).toBe(
      getTracker,
    );
    expect(Reflect.getMetadata(metadataKeys.generateKey, target)).toBe(
      generateKey,
    );
  });

  it('applies supplied options to a class', () => {
    @UseThrottler({ limit: 5, ttl: '30s' })
    class ClassTarget {}

    expect(Reflect.getMetadata(metadataKeys.limit, ClassTarget)).toBe(5);
    expect(Reflect.getMetadata(metadataKeys.ttl, ClassTarget)).toBe(30_000);
  });

  it('works inside another applyDecorators decorator', () => {
    const Composed = () =>
      applyDecorators(UseThrottler({ limit: 3, ttl: '1s' }));

    @Composed()
    class ComposedTarget {}

    expect(Reflect.getMetadata(GUARDS_METADATA, ComposedTarget)).toEqual([
      ThrottlerPlusGuard,
    ]);
    expect(Reflect.getMetadata(metadataKeys.limit, ComposedTarget)).toBe(3);
    expect(Reflect.getMetadata(metadataKeys.ttl, ComposedTarget)).toBe(1_000);
  });
});
