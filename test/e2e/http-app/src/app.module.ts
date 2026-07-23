import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';

import { ThrottlerPlusModule } from '@nest-mods/throttler-plus';
import {
  AlwaysAllowFixtureGuard,
  ClassDefaultController,
  ComposedHeaderController,
  ScenarioController,
} from './app.controller';
import { FixtureUserMiddleware } from './fixture-user.middleware';

@Module({
  imports: [ThrottlerPlusModule.forRoot()],
  controllers: [
    ScenarioController,
    ClassDefaultController,
    ComposedHeaderController,
  ],
  providers: [AlwaysAllowFixtureGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(FixtureUserMiddleware).forRoutes(
      ScenarioController,
      ClassDefaultController,
      ComposedHeaderController,
    );
  }
}
