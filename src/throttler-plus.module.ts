import { DynamicModule, Global, Module } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
  type ThrottlerOptions,
} from '@nestjs/throttler';

import type {
  ThrottlerPlusModuleAsyncOptions,
  ThrottlerPlusModuleOptions,
} from './throttler-plus-module-options.interface.ts';
import { ThrottlerPlusGuard } from './throttler-plus.guard.ts';

function createDefaultThrottlers(): ThrottlerOptions[] {
  return [{ name: 'default', limit: 10, ttl: 60_000 }];
}

function createThrottlerOptions(
  options: ThrottlerPlusModuleOptions,
): ThrottlerModuleOptions {
  const customStorage = Array.isArray(options.throttler)
    ? undefined
    : options.throttler?.storage;

  if (options.redis && customStorage) {
    throw new Error(
      'Cannot configure both "redis" and "throttler.storage".',
    );
  }

  if (Array.isArray(options.throttler)) {
    return {
      throttlers: options.throttler,
      ...(options.redis
        ? { storage: new ThrottlerStorageRedisService(options.redis) }
        : {}),
    };
  }

  return {
    ...options.throttler,
    throttlers: options.throttler?.throttlers ?? createDefaultThrottlers(),
    ...(options.redis
      ? { storage: new ThrottlerStorageRedisService(options.redis) }
      : {}),
  };
}

/**
 * Global configuration module for in-memory or Redis-backed throttling.
 * Use `UseThrottler` or register {@link ThrottlerPlusGuard} to enforce it.
 */
@Global()
@Module({})
export class ThrottlerPlusModule {
  /**
   * Registers the module synchronously.
   *
   * @param options Throttler and Redis options. Defaults to 10 requests per
   * 60 seconds using in-memory storage.
   */
  static forRoot(options: ThrottlerPlusModuleOptions = {}): DynamicModule {
    return {
      module: ThrottlerPlusModule,
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: () => createThrottlerOptions(options),
        }),
      ],
      providers: [ThrottlerPlusGuard],
      exports: [ThrottlerModule, ThrottlerPlusGuard],
    };
  }

  /**
   * Registers the module using a synchronous or asynchronous factory.
   *
   * @param options Factory registration options.
   */
  static forRootAsync(
    options: ThrottlerPlusModuleAsyncOptions,
  ): DynamicModule {
    return {
      module: ThrottlerPlusModule,
      imports: [
        ThrottlerModule.forRootAsync({
          imports: options.imports,
          inject: options.inject,
          useFactory: async (...args: unknown[]) =>
            createThrottlerOptions(await options.useFactory(...args)),
        }),
      ],
      providers: [ThrottlerPlusGuard],
      exports: [ThrottlerModule, ThrottlerPlusGuard],
    };
  }
}
