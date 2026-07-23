import type { RedisOptions } from 'ioredis';
import { randomUUID } from 'node:crypto';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the Redis e2e fixture.`);
  }
  return value;
}

export function createIsolatedRedisOptions(): RedisOptions {
  const portText = requiredEnvironment('E2E_REDIS_PORT');
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `E2E_REDIS_PORT must be a positive integer, got ${portText}.`,
    );
  }

  return {
    connectTimeout: 5_000,
    host: requiredEnvironment('E2E_REDIS_HOST'),
    keyPrefix: `${requiredEnvironment('E2E_REDIS_KEY_PREFIX')}${randomUUID()}:`,
    maxRetriesPerRequest: 1,
    port,
  };
}
