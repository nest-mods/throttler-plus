# @nest-mods/throttler-plus

[![npm version](https://img.shields.io/npm/v/%40nest-mods%2Fthrottler-plus.svg)](https://www.npmjs.com/package/@nest-mods/throttler-plus)

Additional throttling integrations for NestJS 11, built on top of
[`@nestjs/throttler`](https://github.com/nestjs/throttler).

It provides:

- a global module with sensible defaults;
- optional Redis-backed storage through `ioredis`;
- readable decorator TTL values such as `'1s'`, `'10m'`, and `'1h'`;
- custom tracker and key-generation functions;
- lazy GraphQL support without loading GraphQL packages in other applications;
- native ESM and CommonJS package entry points.

## Requirements

- Node.js 24 or newer
- NestJS 11
- `@nestjs/throttler` 6
- `ioredis` 5

## Installation

```bash
npm install @nest-mods/throttler-plus @nestjs/throttler ioredis
```

Nest applications already provide `@nestjs/common` and `@nestjs/core`.

If the decorators are used on GraphQL resolvers, also install the optional
GraphQL peers used by the application:

```bash
npm install @nestjs/graphql graphql
```

## Configuration

### Default in-memory storage

Import `ThrottlerPlusModule` once in the root application module:

```ts
import { Module } from '@nestjs/common';
import { ThrottlerPlusModule } from '@nest-mods/throttler-plus';

@Module({
  imports: [ThrottlerPlusModule.forRoot()],
})
export class AppModule {}
```

The module is global. With no options it uses the upstream in-memory storage and
configures the `default` throttler with:

- limit: `10` requests;
- TTL: `60_000` milliseconds.

### Redis storage

Pass regular `ioredis` options through the `redis` property:

```ts
import { Module } from '@nestjs/common';
import { ThrottlerPlusModule } from '@nest-mods/throttler-plus';

@Module({
  imports: [
    ThrottlerPlusModule.forRoot({
      redis: {
        host: '127.0.0.1',
        port: 6379,
        keyPrefix: 'my-api:throttler:',
      },
    }),
  ],
})
export class AppModule {}
```

The module creates the Redis-backed throttler storage. Closing the Nest
application with `await app.close()` releases the connection. Enabling process
signal hooks remains the responsibility of the consuming application.

### Custom module defaults

The `throttler` property accepts `ThrottlerPlusThrottlerOptions`: either an
array of upstream `ThrottlerOptions` or a partial `ThrottlerModuleOptions`
object:

```ts
ThrottlerPlusModule.forRoot({
  throttler: {
    throttlers: [
      {
        name: 'default',
        limit: 100,
        ttl: 60_000,
      },
    ],
  },
});
```

When only throttler definitions are needed, pass the array directly:

```ts
ThrottlerPlusModule.forRoot({
  throttler: [
    {
      name: 'default',
      limit: 100,
      ttl: 60_000,
    },
  ],
});
```

Module-level TTL values follow `@nestjs/throttler` and are expressed in
milliseconds. Readable string TTL values are provided by the decorator.

Do not configure both `redis` and `throttler.storage`. The module rejects that
combination instead of silently replacing the custom storage. Resources owned by
a custom storage remain the caller's responsibility.

### Asynchronous registration

Use `forRootAsync()` with any Nest provider. This example uses `@nestjs/config`,
but the library does not require it:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerPlusModule } from '@nest-mods/throttler-plus';

@Module({
  imports: [
    ThrottlerPlusModule.forRootAsync({
      imports: [ConfigModule.forRoot()],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.get('REDIS_PORT') ?? 6379),
          keyPrefix: 'my-api:throttler:',
        },
      }),
    }),
  ],
})
export class AppModule {}
```

The factory may return the options directly or return a promise.

## Usage

`UseThrottler()` can decorate a method, a class, or be included in a composed
decorator. It installs `ThrottlerPlusGuard` for the decorated target.

### Use module defaults

```ts
import { Controller, Get } from '@nestjs/common';
import { UseThrottler } from '@nest-mods/throttler-plus';

@Controller('catalog')
export class CatalogController {
  @Get()
  @UseThrottler()
  findAll(): string[] {
    return [];
  }
}
```

### Override the limit and TTL

```ts
import { UseThrottler } from '@nest-mods/throttler-plus';

export class OperationsApi {
  @UseThrottler({ limit: 3, ttl: '10s' })
  submit(): void {}
}
```

`ttl` accepts values supported by `ms`, including `'1s'`, `'10s'`, `'1m'`,
`'60s'`, and `'1h'`. Omitting either `limit` or `ttl` keeps the corresponding
module default.

The same decorator can set a default for every decorated method in a class:

```ts
import { Controller, Get } from '@nestjs/common';
import { UseThrottler } from '@nest-mods/throttler-plus';

@UseThrottler({ limit: 120, ttl: '1m' })
@Controller('reports')
export class ReportsController {
  @Get()
  findAll(): string[] {
    return [];
  }
}
```

### Customize the tracker

Use `getTracker` to decide which requests share a counter:

```ts
import { UseThrottler } from '@nest-mods/throttler-plus';

export class OperationsApi {
  @UseThrottler({
    limit: 5,
    ttl: '1m',
    getTracker: (request) =>
      String(
        request.user?.uid ??
          request.headers['x-api-key'] ??
          request.ip,
      ),
  })
  run(): void {}
}
```

The tracker receives the request object prepared by the active Nest transport.
Avoid returning secrets directly when they could become part of a storage key.

### Customize key generation

Use `generateKey` when the upstream handler-isolated key is not suitable:

```ts
import { UseThrottler } from '@nest-mods/throttler-plus';

export class OperationsApi {
  @UseThrottler({
    limit: 10,
    ttl: '1m',
    generateKey: (context, tracker, throttlerName) =>
      [
        throttlerName,
        context.getClass().name,
        context.getHandler().name,
        tracker,
      ].join(':'),
  })
  run(): void {}
}
```

### Compose decorators

```ts
import { applyDecorators } from '@nestjs/common';
import { UseThrottler } from '@nest-mods/throttler-plus';

export function RateLimitedOperation(): MethodDecorator {
  return applyDecorators(
    UseThrottler({ limit: 2, ttl: '1s' }),
  );
}
```

## API

### `ThrottlerPlusModule`

- `forRoot(options?: ThrottlerPlusModuleOptions)` registers the global module.
- `forRootAsync(options: ThrottlerPlusModuleAsyncOptions)` resolves its options
  from injected Nest providers.

`ThrottlerPlusModuleOptions` contains:

| Property    | Type                            | Description                                                                     |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `throttler` | `ThrottlerPlusThrottlerOptions` | Throttler definitions, storage, tracker, and other `@nestjs/throttler` options. |
| `redis`     | `RedisOptions`                  | Options used to create Redis-backed storage.                                    |

### `UseThrottler(options?)`

| Property      | Type                           | Description                                    |
| ------------- | ------------------------------ | ---------------------------------------------- |
| `limit`       | `number`                       | Maximum requests in the active window.         |
| `ttl`         | `ms.StringValue`               | A readable duration such as `'10s'` or `'1m'`. |
| `getTracker`  | `ThrottlerGetTrackerFunction`  | Produces the counter identity for a request.   |
| `generateKey` | `ThrottlerGenerateKeyFunction` | Produces the final storage key.                |

The package also exports `ThrottlerPlusGuard` and all public option types from
its root entry point.

## Module formats

The package provides conditional exports for native ESM and CommonJS, with
matching TypeScript declarations for each branch.

## License

MIT
