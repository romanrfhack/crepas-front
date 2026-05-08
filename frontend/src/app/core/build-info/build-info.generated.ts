import type { BuildInfo } from './build-info.model';

export const BUILD_INFO = {
  app: 'web',
  packageVersion: '0.0.0',
  commitSha: 'local',
  commitShortSha: 'local',
  branch: 'local',
  runNumber: 'local',
  runId: 'local',
  buildDateUtc: 'local',
  environment: 'local',
  source: 'local',
} as const satisfies BuildInfo;
