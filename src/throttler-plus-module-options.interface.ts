import type { InjectionToken, ModuleMetadata } from '@nestjs/common';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptions,
} from '@nestjs/throttler';
import type { RedisOptions } from 'ioredis';

export type ThrottlerPlusThrottlerOptions =
  | ThrottlerOptions[]
  | Partial<Exclude<ThrottlerModuleOptions, ThrottlerOptions[]>>;

export interface ThrottlerPlusModuleOptions {
  throttler?: ThrottlerPlusThrottlerOptions;
  redis?: RedisOptions;
}

export interface ThrottlerPlusModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // deno-lint-ignore no-explicit-any -- Matches Nest's async factory contract.
  useFactory: (...args: any[]) =>
    | ThrottlerPlusModuleOptions
    | Promise<ThrottlerPlusModuleOptions>;
}
