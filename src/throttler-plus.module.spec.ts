import 'reflect-metadata';

import { Module } from '@nestjs/common';
import {
  getOptionsToken,
  getStorageToken,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import { ThrottlerPlusModule } from './index.ts';

class CallerOwnedStorage implements ThrottlerStorage {
  increment(): ReturnType<ThrottlerStorage['increment']> {
    return Promise.resolve({
      totalHits: 1,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}

const CONFIG_TOKEN = Symbol('CONFIG_TOKEN');

@Module({
  providers: [{ provide: CONFIG_TOKEN, useValue: 'injected-value' }],
  exports: [CONFIG_TOKEN],
})
class ConfigModule {}

describe('ThrottlerPlusModule', () => {
  it('registers the default throttler with upstream memory storage', async () => {
    const app = await Test.createTestingModule({
      imports: [ThrottlerPlusModule.forRoot()],
    }).compile();

    try {
      const options = app.get<ThrottlerModuleOptions>(getOptionsToken());
      expect(options).toEqual({
        throttlers: [{ name: 'default', limit: 10, ttl: 60_000 }],
      });
      expect(app.get(getStorageToken())).toBeInstanceOf(
        ThrottlerStorageService,
      );
    } finally {
      await app.close();
    }
  });

  it('replaces the defaults with array throttler options', async () => {
    const throttlers = [{ name: 'burst', limit: 2, ttl: 1_000 }];
    const app = await Test.createTestingModule({
      imports: [ThrottlerPlusModule.forRoot({ throttler: throttlers })],
    }).compile();

    try {
      const options = app.get<ThrottlerModuleOptions>(getOptionsToken());
      expect(options).toEqual({ throttlers });
    } finally {
      await app.close();
    }
  });

  it('shallow-merges object options over the default throttler', async () => {
    const getTracker = () => 'shared-tracker';
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({
          throttler: { getTracker, setHeaders: false },
        }),
      ],
    }).compile();

    try {
      const options = app.get<ThrottlerModuleOptions>(getOptionsToken());
      expect(options).toEqual({
        getTracker,
        setHeaders: false,
        throttlers: [{ name: 'default', limit: 10, ttl: 60_000 }],
      });
    } finally {
      await app.close();
    }
  });

  it('replaces default throttlers supplied in object options', async () => {
    const throttlers = [{ name: 'sustained', limit: 20, ttl: 30_000 }];
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({
          throttler: { setHeaders: false, throttlers },
        }),
      ],
    }).compile();

    try {
      const options = app.get<ThrottlerModuleOptions>(getOptionsToken());
      expect(options).toEqual({ setHeaders: false, throttlers });
    } finally {
      await app.close();
    }
  });

  it('passes a caller-owned custom storage through unchanged', async () => {
    const storage = new CallerOwnedStorage();
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({ throttler: { storage } }),
      ],
    }).compile();

    try {
      expect(app.get(getStorageToken())).toBe(storage);
    } finally {
      await app.close();
    }
  });

  it('rejects Redis combined with a custom throttler storage at bootstrap', async () => {
    const storage = new CallerOwnedStorage();
    const dynamicModule = ThrottlerPlusModule.forRoot({
      redis: { lazyConnect: true },
      throttler: { storage },
    });

    await expect(
      Test.createTestingModule({ imports: [dynamicModule] }).compile(),
    ).rejects.toThrow(
      'Cannot configure both "redis" and "throttler.storage".',
    );
  });

  it('selects the Redis adapter and closes its owned client exactly once', async () => {
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({ redis: { lazyConnect: true } }),
      ],
    }).compile();
    const storage = app.get<ThrottlerStorageRedisService>(getStorageToken());

    expect(storage).toBeInstanceOf(ThrottlerStorageRedisService);
    const disconnectCalls: Array<boolean | undefined> = [];
    const disconnect = storage.redis.disconnect.bind(storage.redis);
    storage.redis.disconnect = (reconnect?: boolean) => {
      disconnectCalls.push(reconnect);
      disconnect(reconnect);
    };

    await app.close();

    expect(disconnectCalls).toEqual([false]);
  });

  it('forwards imports, injections, and arguments to a synchronous factory', async () => {
    const received: unknown[] = [];
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRootAsync({
          imports: [ConfigModule],
          inject: [CONFIG_TOKEN],
          useFactory: (value: string) => {
            received.push(value);
            return {
              throttler: {
                setHeaders: false,
                throttlers: [{ name: 'sync', limit: 3, ttl: 3_000 }],
              },
            };
          },
        }),
      ],
    }).compile();

    try {
      expect(received).toEqual(['injected-value']);
      expect(app.get<ThrottlerModuleOptions>(getOptionsToken())).toEqual({
        setHeaders: false,
        throttlers: [{ name: 'sync', limit: 3, ttl: 3_000 }],
      });
    } finally {
      await app.close();
    }
  });

  it('awaits an asynchronous user factory', async () => {
    const app = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRootAsync({
          imports: [ConfigModule],
          inject: [CONFIG_TOKEN],
          useFactory: async (value: string) => {
            await Promise.resolve();
            return {
              throttler: [{ name: value, limit: 4, ttl: 4_000 }],
            };
          },
        }),
      ],
    }).compile();

    try {
      expect(app.get<ThrottlerModuleOptions>(getOptionsToken())).toEqual({
        throttlers: [
          { name: 'injected-value', limit: 4, ttl: 4_000 },
        ],
      });
    } finally {
      await app.close();
    }
  });
});
