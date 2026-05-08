export type BuildInfoSource = 'github-actions' | 'local';

export interface BuildInfo {
  app: 'web';
  packageVersion: string;
  commitSha: string;
  commitShortSha: string;
  branch: string;
  runNumber: string;
  runId: string;
  buildDateUtc: string;
  environment: string;
  source: BuildInfoSource;
}

export interface BuildInfoDetailRow {
  label: string;
  value: string;
}
