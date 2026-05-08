import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BuildInfo } from './build-info.model';
import { BuildInfoBadgeComponent } from './build-info-badge.component';
import {
  BuildInfoService,
  formatBuildInfoBadge,
  formatBuildInfoSupportText,
  getBuildInfoDetailRows,
  normalizeBuildInfo,
} from './build-info.service';

const ciBuildInfo: BuildInfo = normalizeBuildInfo({
  app: 'web',
  packageVersion: '0.0.0',
  commitSha: 'bf797d91234567890abcdef1234567890abcdef',
  commitShortSha: 'bf797d9',
  branch: 'main',
  runNumber: '353',
  runId: '987654321',
  buildDateUtc: '2026-05-07T03:42:00Z',
  environment: 'production',
  source: 'github-actions',
});

describe('BuildInfoBadgeComponent', () => {
  let fixture: ComponentFixture<BuildInfoBadgeComponent>;
  let copySupportInfo: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    copySupportInfo = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [BuildInfoBadgeComponent],
      providers: [
        {
          provide: BuildInfoService,
          useValue: {
            info: ciBuildInfo,
            shortLabel: formatBuildInfoBadge(ciBuildInfo),
            detailRows: getBuildInfoDetailRows(ciBuildInfo),
            supportText: formatBuildInfoSupportText(ciBuildInfo),
            copySupportInfo,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuildInfoBadgeComponent);
    fixture.detectChanges();
  });

  it('muestra el formato corto de build', () => {
    expect(fixture.nativeElement.textContent).toContain('Web r353 · bf797d9');
  });

  it('abre y cierra el detalle de versión', () => {
    const button = fixture.nativeElement.querySelector('.build-info__badge') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Información de versión');
    expect(fixture.nativeElement.textContent).toContain('bf797d91234567890abcdef1234567890abcdef');

    const closeButton = fixture.nativeElement.querySelector(
      '.build-info__close',
    ) as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Información de versión');
  });

  it('muestra commit, branch, run number y fecha en el detalle', () => {
    const button = fixture.nativeElement.querySelector('.build-info__badge') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Run number');
    expect(content).toContain('353');
    expect(content).toContain('Branch');
    expect(content).toContain('main');
    expect(content).toContain('Commit completo');
    expect(content).toContain('2026-05-07T03:42:00Z');
  });

  it('copia información de soporte', async () => {
    const button = fixture.nativeElement.querySelector('.build-info__badge') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const copyButton = fixture.nativeElement.querySelector(
      '.build-info__copy',
    ) as HTMLButtonElement;
    copyButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(copySupportInfo).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Información copiada.');
  });

  it('usa fallback local sin valores undefined o null', () => {
    const fallback = normalizeBuildInfo({
      app: 'web',
      packageVersion: undefined,
      commitSha: null as unknown as string,
      commitShortSha: undefined,
      branch: undefined,
      runNumber: undefined,
      runId: undefined,
      buildDateUtc: undefined,
      environment: undefined,
      source: 'local',
    });
    const rendered = `${formatBuildInfoBadge(fallback)}\n${formatBuildInfoSupportText(fallback)}`;

    expect(formatBuildInfoBadge(fallback)).toBe('Web rlocal · local');
    expect(rendered).not.toContain('undefined');
    expect(rendered).not.toContain('null');
  });

  it('no expone campos no permitidos en el texto de soporte', () => {
    const normalized = normalizeBuildInfo({
      app: 'web',
      packageVersion: '0.0.0',
      commitSha: 'abc1234',
      commitShortSha: 'abc1234',
      branch: 'main',
      runNumber: '353',
      runId: '987654321',
      buildDateUtc: '2026-05-07T03:42:00Z',
      environment: 'production',
      source: 'github-actions',
      token: 'SECRET_TOKEN',
    } as Partial<BuildInfo> & { token: string });

    expect(formatBuildInfoSupportText(normalized)).not.toContain('SECRET_TOKEN');
  });
});
