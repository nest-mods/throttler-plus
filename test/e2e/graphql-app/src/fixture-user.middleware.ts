import { Injectable, type NestMiddleware } from '@nestjs/common';

interface FixtureRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: { uid: string };
}

@Injectable()
export class FixtureUserMiddleware implements NestMiddleware {
  use(
    request: FixtureRequest,
    _response: unknown,
    next: () => void,
  ): void {
    const header = request.headers['x-fixture-user'];
    const uid = Array.isArray(header) ? header[0] : header;

    if (uid) {
      request.user = { uid };
    }

    next();
  }
}
