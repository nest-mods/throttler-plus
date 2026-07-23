import type { InjectionToken, ModuleMetadata } from '@nestjs/common';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptions,
} from '@nestjs/throttler';
import type { RedisOptions } from 'ioredis';

/**
 * Throttler definitions or partial upstream module options.
 * Module-level TTL values are expressed in milliseconds.
 */
export type ThrottlerPlusThrottlerOptions =
  | ThrottlerOptions[]
  | Partial<Exclude<ThrottlerModuleOptions, ThrottlerOptions[]>>;

/**
 * Module options. Defaults to in-memory storage and 10 requests per 60 seconds.
 */
export interface ThrottlerPlusModuleOptions {
  /**
   * Throttler definitions and common options forwarded to `@nestjs/throttler`.
   * Any supplied `throttlers` array replaces the default definition.
   */
  throttler?: ThrottlerPlusThrottlerOptions;

  /**
   * Options for a module-owned Redis client. Cannot be combined with
   * `throttler.storage`; the client is disconnected during Nest module teardown.
   */
  redis?: RedisOptions;
}

/** Options for factory-based module registration. */
export interface ThrottlerPlusModuleAsyncOptions {
  /** Modules that provide dependencies for `useFactory`. */
  imports?: ModuleMetadata['imports'];

  /** Provider tokens passed to `useFactory` in the same order. */
  inject?: InjectionToken[];

  /** Creates the module options synchronously or asynchronously. */
  // deno-lint-ignore no-explicit-any -- Matches Nest's async factory contract.
  useFactory: (...args: any[]) =>
    | ThrottlerPlusModuleOptions
    | Promise<ThrottlerPlusModuleOptions>;
}
