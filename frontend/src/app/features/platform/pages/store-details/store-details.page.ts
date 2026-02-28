import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PlatformStoreDetailsDto } from '../../models/platform.models';
import { PlatformStoresApiService } from '../../services/platform-stores-api.service';

@Component({
  selector: 'app-platform-store-details-page',
  imports: [ReactiveFormsModule],
  template: `
    <section data-testid="platform-store-details-page">
      <h2>Detalle de store</h2>

      @if (error()) {
        <p data-testid="platform-store-edit-error">{{ error() }}</p>
      }
      @if (success()) {
        <p data-testid="platform-store-edit-success">{{ success() }}</p>
      }

      @if (loading()) {
        <p>Cargando...</p>
      } @else if (details()) {
        <div>
          <p data-testid="platform-store-details-name">{{ details()!.name }}</p>
          <p data-testid="platform-store-details-timezone">{{ details()!.timeZoneId }}</p>
          <p data-testid="platform-store-details-default">{{ details()!.isDefaultStore ? 'Default' : 'No default' }}</p>
          <p data-testid="platform-store-details-has-admin">{{ details()!.hasAdminStore ? 'Con AdminStore' : 'Sin AdminStore' }}</p>

          @if (!details()!.isDefaultStore) {
            <button type="button" [disabled]="settingDefault()" (click)="setAsDefault()">Set default store</button>
          }

          <button type="button" data-testid="platform-store-edit-open" (click)="openEdit()">Editar store</button>
        </div>

        @if (editOpen()) {
          <form data-testid="platform-store-edit-form" (submit)="submit($event)">
            <label>
              Name
              <input data-testid="platform-store-edit-name" [formControl]="nameControl" />
            </label>

            <label>
              TimeZoneId
              <input data-testid="platform-store-edit-timezone" [formControl]="timeZoneControl" />
            </label>

            <label>
              <input type="checkbox" [formControl]="isActiveControl" />
              Activa
            </label>

            <button
              type="submit"
              data-testid="platform-store-edit-submit"
              [disabled]="saveDisabled()"
            >
              Guardar
            </button>
            <button
              type="button"
              data-testid="platform-store-edit-cancel"
              [disabled]="saving()"
              (click)="cancelEdit()"
            >
              Cancelar
            </button>
          </form>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PlatformStoresApiService);

  readonly loading = signal(true);
  readonly details = signal<PlatformStoreDetailsDto | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editOpen = signal(false);
  readonly saving = signal(false);
  readonly settingDefault = signal(false);

  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly timeZoneControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  readonly saveDisabled = computed(() =>
    this.saving() || this.nameControl.invalid || this.timeZoneControl.invalid,
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const storeId = this.storeId();
    if (!storeId) {
      this.error.set('Store inválida.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.getStoreDetails(storeId);
      this.details.set(response);
      this.nameControl.setValue(response.name);
      this.timeZoneControl.setValue(response.timeZoneId);
      this.isActiveControl.setValue(response.isActive);
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.loading.set(false);
    }
  }

  openEdit(): void {
    this.editOpen.set(true);
    this.success.set(null);
    this.error.set(null);
  }

  cancelEdit(): void {
    this.editOpen.set(false);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.nameControl.markAsTouched();
    this.timeZoneControl.markAsTouched();

    if (this.nameControl.invalid || this.timeZoneControl.invalid || this.saving()) {
      return;
    }

    const storeId = this.storeId();
    if (!storeId) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const updated = await this.api.updateStore(storeId, {
        name: this.nameControl.value,
        timeZoneId: this.timeZoneControl.value,
        isActive: this.isActiveControl.value,
      });
      this.details.set(updated);
      this.success.set('Store actualizada correctamente.');
      this.editOpen.set(false);
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.saving.set(false);
    }
  }

  async setAsDefault(): Promise<void> {
    const current = this.details();
    if (!current || current.isDefaultStore) {
      return;
    }

    this.settingDefault.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      await this.api.updateTenantDefaultStore(current.tenantId, { defaultStoreId: current.id });
      this.success.set('Sucursal principal actualizada.');
      await this.load();
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.settingDefault.set(false);
    }
  }

  private storeId(): string | null {
    return this.route.snapshot.paramMap.get('storeId');
  }

  private mapProblemDetails(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo completar la acción.';
    }

    const payload = error.error as
      | { detail?: string; title?: string; errors?: Record<string, string[] | undefined> }
      | null
      | undefined;

    if (payload?.detail) {
      return payload.detail;
    }

    const firstValidation = payload?.errors
      ? Object.values(payload.errors)
          .flat()
          .find((item): item is string => typeof item === 'string')
      : null;

    return firstValidation ?? payload?.title ?? 'No se pudo completar la acción.';
  }
}
