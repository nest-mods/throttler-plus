export const HTTP_SCENARIO_NAMES = [
  'method-path',
  'class-default',
  'method-default',
  'payload-hash',
  'user-ip',
  'email-source',
  'username',
  'email-ip',
  'path-hash',
  'composed-header',
] as const;

export type HttpScenarioName = (typeof HTTP_SCENARIO_NAMES)[number];
export type TrackerScenarioName = HttpScenarioName | 'redis-shared';

export interface TrackerObservation {
  scenario: TrackerScenarioName;
  value: string;
}

export const trackerObservations: TrackerObservation[] = [];

export function observeTracker(
  scenario: TrackerScenarioName,
  value: string,
): string {
  trackerObservations.push({ scenario, value });
  return value;
}

export function clearTrackerObservations(): void {
  trackerObservations.length = 0;
}
