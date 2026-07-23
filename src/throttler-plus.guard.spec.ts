import 'reflect-metadata';

import {
  Controller,
  Get,
  type INestApplication,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ThrottlerPlusGuard, ThrottlerPlusModule } from './index.ts';

@Controller('guard-probe')
@UseGuards(ThrottlerPlusGuard)
class GuardProbeController {
  @Get()
  probe(): string {
    return 'ok';
  }
}

describe('ThrottlerPlusGuard', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('is injectable and preserves upstream HTTP throttling behavior', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [
        ThrottlerPlusModule.forRoot({
          throttler: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
      ],
      controllers: [GuardProbeController],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();

    expect(testingModule.get(ThrottlerPlusGuard)).toBeInstanceOf(
      ThrottlerGuard,
    );
    await request(app.getHttpServer()).get('/guard-probe').expect(200, 'ok');
    await request(app.getHttpServer()).get('/guard-probe').expect(429);
  });
});
