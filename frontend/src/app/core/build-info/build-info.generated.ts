import type { BuildInfo } from './build-info.model';

export const BUILD_INFO = {
  app: 'web',
  packageVersion: '0.0.0',
  commitSha: 'bf797d9eaa8c151e0d34a28515ddaf1161db9fbd',
  commitShortSha: 'bf797d9',
  branch: 'main',
  runNumber: 'local',
  runId: 'local',
  buildDateUtc: '2026-05-07T14:27:12Z',
  environment: 'local',
  source: 'local',
} as const satisfies BuildInfo;
