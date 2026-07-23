import type {
  ThrottlerGenerateKeyFunction,
  ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import type ms from 'ms';

export interface UseThrottlerOptions {
  limit?: number;
  ttl?: ms.StringValue;
  getTracker?: ThrottlerGetTrackerFunction;
  generateKey?: ThrottlerGenerateKeyFunction;
}
