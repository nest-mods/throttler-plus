import type {
  ThrottlerGenerateKeyFunction,
  ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import type ms from 'ms';

/** Per-target overrides for the `default` throttler. */
export interface UseThrottlerOptions {
  /** Maximum requests per window. Defaults to inherited configuration. */
  limit?: number;

  /**
   * Readable window duration such as `'1s'` or `'1m'`. Defaults to inherited
   * configuration.
   */
  ttl?: ms.StringValue;

  /** Produces the identity whose requests share a counter. */
  getTracker?: ThrottlerGetTrackerFunction;

  /** Produces the logical key passed to the configured storage. */
  generateKey?: ThrottlerGenerateKeyFunction;
}
