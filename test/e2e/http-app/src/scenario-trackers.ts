import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

import { observeTracker } from './scenario-observations';

interface FixtureUser {
  id?: string;
  uid?: string;
}

interface FixtureRequest {
  body?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  user?: FixtureUser;
}

function fixtureRequest(request: Record<string, unknown>): FixtureRequest {
  return request as unknown as FixtureRequest;
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function nonNullPayload(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      subjectId: body.subjectId,
      quantity: body.quantity,
      category: body.category,
    }).filter(([, value]) => value !== null && value !== undefined),
  );
}

export const methodPathTracker: ThrottlerGetTrackerFunction = (request) => {
  const { method, path } = fixtureRequest(request);
  return observeTracker('method-path', `${method}:${path}`);
};

export const payloadHashTracker: ThrottlerGetTrackerFunction = (request) => {
  const { body = {}, user } = fixtureRequest(request);
  const userId = body.userId ?? user?.uid ?? user?.id;
  const payload = nonNullPayload(body);
  return observeTracker(
    'payload-hash',
    `${String(userId)}_${md5(JSON.stringify(payload))}`,
  );
};

export const userIpTracker: ThrottlerGetTrackerFunction = (request) => {
  const { ip, user } = fixtureRequest(request);
  return observeTracker('user-ip', String(user?.uid ?? ip));
};

export const emailSourceTracker: ThrottlerGetTrackerFunction = (request) => {
  const { body = {}, query = {} } = fixtureRequest(request);
  return observeTracker('email-source', String(query.email ?? body.email));
};

export const usernameTracker: ThrottlerGetTrackerFunction = (request) => {
  const { body = {} } = fixtureRequest(request);
  return observeTracker('username', String(body.username));
};

export const emailIpTracker: ThrottlerGetTrackerFunction = (request) => {
  const { body = {}, ip } = fixtureRequest(request);
  return observeTracker('email-ip', String(body.email || ip));
};

export const pathHashTracker: ThrottlerGetTrackerFunction = (request) => {
  const { body = {}, path, user } = fixtureRequest(request);
  const userId = body.userId ?? user?.id;
  return observeTracker(
    'path-hash',
    `${String(userId)}_${md5(JSON.stringify({ path }))}`,
  );
};

export const composedHeaderTracker: ThrottlerGetTrackerFunction = (request) => {
  const { headers, user } = fixtureRequest(request);
  return observeTracker(
    'composed-header',
    String(headers['x-client-key'] || user?.id),
  );
};
