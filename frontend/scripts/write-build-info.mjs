import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(frontendRoot, 'package.json');
const generatedTsPath = resolve(frontendRoot, 'src/app/core/build-info/build-info.generated.ts');
const assetJsonPath = resolve(frontendRoot, 'src/assets/build-info.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const packageVersion = String(packageJson.version ?? '0.0.0');
const githubActions = process.env.GITHUB_ACTIONS === 'true';

function getArgValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function runGit(args, fallback) {
  try {
    return execSync(`git ${args}`, {
      cwd: frontendRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function clean(value, fallback) {
  const text = String(value ?? '').trim();
  return text && text !== 'undefined' && text !== 'null' ? text : fallback;
}

const commitSha = clean(process.env.GITHUB_SHA, runGit('rev-parse HEAD', 'local'));
const commitShortSha = githubActions
  ? commitSha.slice(0, 7)
  : clean(runGit('rev-parse --short=7 HEAD', 'local'), commitSha.slice(0, 7) || 'local');
const branch = clean(process.env.GITHUB_REF_NAME, runGit('rev-parse --abbrev-ref HEAD', 'local'));
const environment = clean(
  getArgValue('environment') || process.env.BUILD_INFO_ENVIRONMENT || process.env.APP_ENVIRONMENT,
  githubActions ? 'production' : 'local',
);

const buildInfo = {
  app: 'web',
  packageVersion,
  commitSha,
  commitShortSha,
  branch,
  runNumber: githubActions ? clean(process.env.GITHUB_RUN_NUMBER, 'local') : 'local',
  runId: githubActions ? clean(process.env.GITHUB_RUN_ID, 'local') : 'local',
  buildDateUtc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  environment,
  source: githubActions ? 'github-actions' : 'local',
};

const tsFields = [
  'app',
  'packageVersion',
  'commitSha',
  'commitShortSha',
  'branch',
  'runNumber',
  'runId',
  'buildDateUtc',
  'environment',
  'source',
];

function toTsString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function toTsObject(value) {
  const lines = tsFields.map((field) => `  ${field}: ${toTsString(value[field])},`);
  return `{\n${lines.join('\n')}\n}`;
}

const generatedTs = `import type { BuildInfo } from './build-info.model';

export const BUILD_INFO = ${toTsObject(buildInfo)} as const satisfies BuildInfo;
`;

mkdirSync(dirname(generatedTsPath), { recursive: true });
mkdirSync(dirname(assetJsonPath), { recursive: true });
writeFileSync(generatedTsPath, generatedTs, 'utf8');
writeFileSync(assetJsonPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

console.log(`Wrote ${generatedTsPath}`);
console.log(`Wrote ${assetJsonPath}`);
