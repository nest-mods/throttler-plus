import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { randomUUID } from 'node:crypto';

import { ThrottlerPlusModule } from '@nest-mods/throttler-plus';

import { FixtureUserMiddleware } from './fixture-user.middleware';
import {
  AlwaysAllowFixtureGuard,
  ClassDefaultResolver,
  ScenarioResolver,
} from './scenario.resolver';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for GraphQL e2e.`);
  }
  return value;
}

function redisPort(): number {
  const value = requiredEnvironment('E2E_REDIS_PORT');
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`E2E_REDIS_PORT must be a positive integer, got ${value}.`);
  }
  return port;
}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: { federation: 2 },
    }),
    ThrottlerPlusModule.forRootAsync({
      useFactory: () => ({
        redis: {
          connectTimeout: 5_000,
          host: requiredEnvironment('E2E_REDIS_HOST'),
          keyPrefix: `${
            requiredEnvironment('E2E_REDIS_KEY_PREFIX')
          }${randomUUID()}:`,
          maxRetriesPerRequest: 1,
          port: redisPort(),
        },
      }),
    }),
  ],
  providers: [
    AlwaysAllowFixtureGuard,
    ClassDefaultResolver,
    ScenarioResolver,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(FixtureUserMiddleware).forRoutes('*');
  }
}
