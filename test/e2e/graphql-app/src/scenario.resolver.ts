import {
  type CanActivate,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { UseThrottler } from '@nest-mods/throttler-plus';

interface FixtureRequest {
  user: { uid: unknown };
}

function fixtureUidTracker(request: Record<string, unknown>): string {
  return String((request as unknown as FixtureRequest).user.uid);
}

@Injectable()
export class AlwaysAllowFixtureGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Resolver()
export class ScenarioResolver {
  @Query(() => String)
  @SetMetadata('fixture:policy', 'method-default')
  @UseGuards(AlwaysAllowFixtureGuard)
  @UseThrottler({ limit: 1, ttl: '1s' })
  methodDefaultPrimary(): string {
    return 'methodDefaultPrimary';
  }

  @Query(() => String)
  @UseThrottler({ limit: 1, ttl: '1s' })
  methodDefaultAlternate(): string {
    return 'methodDefaultAlternate';
  }

  @Query(() => String)
  @UseThrottler({ limit: 30 })
  limitOnly(): string {
    return 'limitOnly';
  }

  @Query(() => String)
  @UseThrottler({ limit: 1, ttl: '60s' })
  minuteWindow(): string {
    return 'minuteWindow';
  }

  @Query(() => String)
  @UseThrottler({
    getTracker: fixtureUidTracker,
    limit: 1,
    ttl: '1s',
  })
  userShort(): string {
    return 'userShort';
  }

  @Query(() => String)
  @UseThrottler({
    getTracker: fixtureUidTracker,
    limit: 1,
    ttl: '3s',
  })
  userThreeSeconds(): string {
    return 'userThreeSeconds';
  }

  @Query(() => String)
  @SetMetadata('fixture:policy', 'module-defaults')
  @UseThrottler()
  moduleDefaults(): string {
    return 'moduleDefaults';
  }
}

@Resolver()
@UseThrottler({ limit: 120, ttl: '1m' })
export class ClassDefaultResolver {
  @Query(() => String)
  classDefault(): string {
    return 'classDefault';
  }
}
