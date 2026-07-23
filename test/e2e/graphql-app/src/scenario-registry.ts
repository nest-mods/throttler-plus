export const GRAPHQL_SCENARIOS = [
  {
    id: 'method-default',
    fields: ['methodDefaultPrimary', 'methodDefaultAlternate'],
    limit: 1,
    tracker: 'ip',
    ttlSeconds: 1,
  },
  {
    id: 'limit-only',
    fields: ['limitOnly'],
    limit: 30,
    tracker: 'ip',
    ttlSeconds: 60,
  },
  {
    id: 'minute-window',
    fields: ['minuteWindow'],
    limit: 1,
    tracker: 'ip',
    ttlSeconds: 60,
  },
  {
    id: 'user-short',
    fields: ['userShort'],
    limit: 1,
    tracker: 'uid',
    ttlSeconds: 1,
  },
  {
    id: 'user-three-seconds',
    fields: ['userThreeSeconds'],
    limit: 1,
    tracker: 'uid',
    ttlSeconds: 3,
  },
  {
    id: 'class-default',
    fields: ['classDefault'],
    limit: 120,
    tracker: 'ip',
    ttlSeconds: 60,
  },
  {
    id: 'module-defaults',
    fields: ['moduleDefaults'],
    limit: 10,
    tracker: 'ip',
    ttlSeconds: 60,
  },
] as const;

export type GraphqlScenario = (typeof GRAPHQL_SCENARIOS)[number];
export type GraphqlScenarioId = GraphqlScenario['id'];
