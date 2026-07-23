import { Injectable, type NestMiddleware } from '@nestjs/common';

interface FixtureUserRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string; uid?: string };
}

function parseFixtureUser(value: string): { id?: string; uid?: string } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return {
        ...(typeof record.id === 'string' ? { id: record.id } : {}),
        ...(typeof record.uid === 'string' ? { uid: record.uid } : {}),
      };
    }
  } catch {
    return { id: value, uid: value };
  }

  return { id: value, uid: value };
}

@Injectable()
export class FixtureUserMiddleware implements NestMiddleware {
  use(
    request: FixtureUserRequest,
    _response: unknown,
    next: () => void,
  ): void {
    const header = request.headers['x-fixture-user'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) {
      request.user = parseFixtureUser(value);
    }
    next();
  }
}
