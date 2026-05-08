import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BuildInfoService } from './build-info.service';

@Component({
  selector: 'app-build-info-badge',
  template: `
    <div class="build-info">
      <button
        type="button"
        class="build-info__badge"
        aria-label="Ver información de versión"
        [attr.aria-expanded]="detailsOpen()"
        (click)="toggleDetails()"
      >
        {{ buildInfo.shortLabel }}
      </button>

      @if (detailsOpen()) {
        <section class="build-info__panel" role="dialog" aria-label="Información de versión">
          <header class="build-info__panel-header">
            <div>
              <h2>Información de versión</h2>
              <p>{{ buildInfo.shortLabel }}</p>
            </div>
            <button
              type="button"
              class="build-info__close"
              aria-label="Cerrar información de versión"
              (click)="closeDetails()"
            >
              ×
            </button>
          </header>

          <dl class="build-info__details">
            @for (row of buildInfo.detailRows; track row.label) {
              <div class="build-info__row">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            }
          </dl>

          <button type="button" class="build-info__copy" (click)="copySupportInfo()">
            Copiar información de soporte
          </button>

          @if (copyState() === 'copied') {
            <p class="build-info__copy-state" role="status">Información copiada.</p>
          } @else if (copyState() === 'failed') {
            <p class="build-info__copy-state build-info__copy-state--error" role="status">
              No se pudo copiar automáticamente.
            </p>
          }
        </section>
      }
    </div>
  `,
  styleUrl: './build-info-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildInfoBadgeComponent {
  readonly buildInfo = inject(BuildInfoService);
  readonly detailsOpen = signal(false);
  readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');

  toggleDetails() {
    this.detailsOpen.update((isOpen) => !isOpen);
    this.copyState.set('idle');
  }

  closeDetails() {
    this.detailsOpen.set(false);
    this.copyState.set('idle');
  }

  async copySupportInfo() {
    try {
      const copied = await this.buildInfo.copySupportInfo();
      this.copyState.set(copied ? 'copied' : 'failed');
    } catch {
      this.copyState.set('failed');
    }
  }
}
