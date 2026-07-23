import {
  applyDecorators,
  type CanActivate,
  Controller,
  Get,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UseThrottler } from '@nest-mods/throttler-plus';
import {
  composedHeaderTracker,
  emailIpTracker,
  emailSourceTracker,
  methodPathTracker,
  pathHashTracker,
  payloadHashTracker,
  userIpTracker,
  usernameTracker,
} from './scenario-trackers';

function result(scenario: string): { scenario: string } {
  return { scenario };
}

@Controller('scenarios')
export class ScenarioController {
  @Get('method-path')
  @UseThrottler({
    getTracker: methodPathTracker,
    limit: 30,
    ttl: '60s',
  })
  methodPath(): { scenario: string } {
    return result('method-path');
  }

  @Get('method-default')
  @UseThrottler({ limit: 10, ttl: '1m' })
  methodDefault(): { scenario: string } {
    return result('method-default');
  }

  @Post('payload-hash')
  @UseThrottler({
    getTracker: payloadHashTracker,
    limit: 1,
    ttl: '10s',
  })
  payloadHash(): { scenario: string } {
    return result('payload-hash');
  }

  @Get('user-ip')
  @UseThrottler({ getTracker: userIpTracker, limit: 60, ttl: '1m' })
  userIp(): { scenario: string } {
    return result('user-ip');
  }

  @Post('email-source')
  @UseThrottler({
    getTracker: emailSourceTracker,
    limit: 1000,
    ttl: '1h',
  })
  emailSource(): { scenario: string } {
    return result('email-source');
  }

  @Post('username')
  @UseThrottler({ getTracker: usernameTracker, limit: 1000, ttl: '1h' })
  username(): { scenario: string } {
    return result('username');
  }

  @Post('email-ip')
  @UseThrottler({ getTracker: emailIpTracker, limit: 1, ttl: '10s' })
  emailIp(): { scenario: string } {
    return result('email-ip');
  }

  @Post(['path-hash', 'path-hash/alternate'])
  @UseThrottler({ getTracker: pathHashTracker, limit: 2, ttl: '60s' })
  pathHash(): { scenario: string } {
    return result('path-hash');
  }
}

@Controller('scenarios/class-default')
@UseThrottler({ limit: 30, ttl: '60s' })
export class ClassDefaultController {
  @Get()
  run(): { scenario: string } {
    return result('class-default');
  }
}

@Injectable()
export class AlwaysAllowFixtureGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

function UseGenericFixturePolicy(): ClassDecorator {
  return applyDecorators(
    UseGuards(AlwaysAllowFixtureGuard),
    UseThrottler({
      getTracker: composedHeaderTracker,
      limit: 2,
      ttl: '1s',
    }),
  );
}

@Controller('scenarios/composed-header')
@UseGenericFixturePolicy()
export class ComposedHeaderController {
  @Get()
  run(): { scenario: string } {
    return result('composed-header');
  }
}
