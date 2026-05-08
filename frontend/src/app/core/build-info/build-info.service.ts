import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BUILD_INFO } from './build-info.generated';
import { BuildInfo, BuildInfoDetailRow } from './build-info.model';

const FALLBACK_BUILD_INFO: BuildInfo = {
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
};

@Injectable({ providedIn: 'root' })
export class BuildInfoService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly info = normalizeBuildInfo(BUILD_INFO);
  readonly shortLabel = formatBuildInfoBadge(this.info);
  readonly detailRows = getBuildInfoDetailRows(this.info);
  readonly supportText = formatBuildInfoSupportText(this.info);

  async copySupportInfo() {
    const text = this.supportText;

    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }

    return this.copyWithTextarea(text);
  }

  private copyWithTextarea(text: string) {
    const body = this.document.body;
    if (!body) {
      return false;
    }

    const textarea = this.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return this.document.execCommand('copy');
    } finally {
      body.removeChild(textarea);
    }
  }
}

export function normalizeBuildInfo(raw: Partial<BuildInfo> | null | undefined): BuildInfo {
  const commitSha = cleanValue(raw?.commitSha, FALLBACK_BUILD_INFO.commitSha);
  const commitShortSha = cleanValue(raw?.commitShortSha, commitSha.slice(0, 7) || 'local');
  const source = raw?.source === 'github-actions' ? 'github-actions' : 'local';

  return {
    app: 'web',
    packageVersion: cleanValue(raw?.packageVersion, FALLBACK_BUILD_INFO.packageVersion),
    commitSha,
    commitShortSha,
    branch: cleanValue(raw?.branch, FALLBACK_BUILD_INFO.branch),
    runNumber: cleanValue(raw?.runNumber, FALLBACK_BUILD_INFO.runNumber),
    runId: cleanValue(raw?.runId, FALLBACK_BUILD_INFO.runId),
    buildDateUtc: cleanValue(raw?.buildDateUtc, FALLBACK_BUILD_INFO.buildDateUtc),
    environment: cleanValue(raw?.environment, FALLBACK_BUILD_INFO.environment),
    source,
  };
}

export function formatBuildInfoBadge(info: BuildInfo) {
  return `Web r${info.runNumber} · ${info.commitShortSha}`;
}

export function getBuildInfoDetailRows(info: BuildInfo): BuildInfoDetailRow[] {
  return [
    { label: 'Aplicación', value: 'CobranzaDigital Web' },
    { label: 'Versión package.json', value: info.packageVersion },
    { label: 'Run number', value: info.runNumber },
    { label: 'Run id', value: info.runId },
    { label: 'Commit corto', value: info.commitShortSha },
    { label: 'Commit completo', value: info.commitSha },
    { label: 'Branch', value: info.branch },
    { label: 'Entorno', value: info.environment },
    { label: 'Fecha UTC de build', value: info.buildDateUtc },
    { label: 'Fuente', value: info.source },
  ];
}

export function formatBuildInfoSupportText(info: BuildInfo) {
  return [
    'CobranzaDigital Web',
    `Version: ${info.packageVersion}`,
    `Build: r${info.runNumber}`,
    `Commit: ${info.commitShortSha}`,
    `Branch: ${info.branch}`,
    `Environment: ${info.environment}`,
    `Build date UTC: ${info.buildDateUtc}`,
  ].join('\n');
}

function cleanValue(value: unknown, fallback: string) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  return text && text !== 'undefined' && text !== 'null' ? text : fallback;
}
