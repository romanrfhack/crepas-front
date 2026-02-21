import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../auth/services/auth.service';
import { PosCatalogSnapshotService } from '../../../../pos/services/pos-catalog-snapshot.service';
import { StoreContextService } from '../../../../pos/services/store-context.service';
import { PlatformTenantContextService } from '../../../../platform/services/platform-tenant-context.service';
import {
  PosInventorySettingsDto,
  StoreInventoryItemDto,
} from '../../models/pos-catalog.models';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';

@Component({
  selector: 'app-pos-inventory-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="inventory-page" data-testid="inventory-page">
      <h2>Inventario POS</h2>

      @if (globalError(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }

      <div class="settings-row">
        <label>
          <input
            type="checkbox"
            [formControl]="showOnlyInStockControl"
            data-testid="inventory-settings-showOnlyInStock"
          />
          POS: mostrar solo con existencias
        </label>
        <button type="button" (click)="saveSettings()" data-testid="inventory-settings-save">
          Guardar configuración
        </button>
      </div>

      <div class="filters-row">
        <label>
          <input
            type="checkbox"
            [formControl]="onlyWithStockFilterControl"
            data-testid="inventory-filter-only-stock"
          />
          Mostrar solo con stock
        </label>


        <label for="inventory-store-id">Sucursal</label>
        <input
          id="inventory-store-id"
          [formControl]="storeIdControl"
          data-testid="inventory-store-select"
        />

        <label for="inventory-search">Buscar</label>
        <input id="inventory-search" [formControl]="searchControl" data-testid="inventory-search" />

        <button type="button" (click)="loadInventory()">Buscar</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Existencia</th>
            <th>Última actualización</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (item of visibleItems(); track item.productId) {
            <tr [attr.data-testid]="'inventory-row-' + item.productId">
              <td>{{ item.productName }} @if (item.productSku) {<span>({{ item.productSku }})</span>}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  [value]="draftOnHand(item.productId, item.onHand)"
                  (input)="updateOnHand(item.productId, $event)"
                  [attr.data-testid]="'inventory-onhand-' + item.productId"
                />
              </td>
              <td>{{ formatUpdatedAt(item.updatedAtUtc) }}</td>
              <td>
                <button
                  type="button"
                  (click)="saveRow(item)"
                  [attr.data-testid]="'inventory-save-' + item.productId"
                >
                  Guardar
                </button>
                @if (rowErrors()[item.productId]; as rowError) {
                  <p class="error" role="alert">{{ rowError }}</p>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    .inventory-page { display: flex; flex-direction: column; gap: 1rem; }
    .settings-row, .filters-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .error { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private readonly api = inject(PosInventoryAdminApiService);
  private readonly storeContext = inject(StoreContextService);
  private readonly authService = inject(AuthService);
  private readonly tenantContext = inject(PlatformTenantContextService);
  private readonly snapshotService = inject(PosCatalogSnapshotService);

  readonly items = signal<StoreInventoryItemDto[]>([]);
  readonly globalError = signal<string | null>(null);
  readonly rowErrors = signal<Record<string, string>>({});
  readonly onHandDrafts = signal<Record<string, number>>({});

  readonly storeIdControl = new FormControl(this.storeContext.getActiveStoreId() ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly showOnlyInStockControl = new FormControl(false, { nonNullable: true });
  readonly onlyWithStockFilterControl = new FormControl(false, { nonNullable: true });

  constructor() {
    void this.loadInventory();
  }

  async loadInventory() {
    this.globalError.set(this.getPlatformTenantRequiredError());
    if (this.globalError()) {
      return;
    }

    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.globalError.set('Selecciona una sucursal para consultar inventario.');
      return;
    }

    this.globalError.set(null);
    try {
      const response = await this.api.listInventory(storeId, this.searchControl.value);
      this.items.set(response);
      this.onHandDrafts.set(
        response.reduce<Record<string, number>>((acc, item) => {
          acc[item.productId] = item.onHand;
          return acc;
        }, {}),
      );
    } catch (error) {
      this.globalError.set(this.toUiErrorMessage(error));
    }
  }

  updateOnHand(productId: string, event: Event) {
    const value = Number((event.target as HTMLInputElement).value ?? 0);
    this.onHandDrafts.update((drafts) => ({ ...drafts, [productId]: Number.isFinite(value) ? value : 0 }));
  }

  draftOnHand(productId: string, fallback: number) {
    return this.onHandDrafts()[productId] ?? fallback;
  }

  visibleItems() {
    return this.onlyWithStockFilterControl.value
      ? this.items().filter((item) => item.onHand > 0)
      : this.items();
  }

  formatUpdatedAt(value: string | null | undefined) {
    return value ?? '—';
  }

  async saveRow(item: StoreInventoryItemDto) {
    const nextOnHand = this.draftOnHand(item.productId, item.onHand);
    if (nextOnHand < 0) {
      this.rowErrors.update((errors) => ({ ...errors, [item.productId]: 'La existencia no puede ser negativa.' }));
      return;
    }

    this.rowErrors.update((errors) => ({ ...errors, [item.productId]: '' }));
    try {
      await this.api.upsertInventory({
        storeId: this.storeIdControl.value.trim(),
        productId: item.productId,
        onHand: nextOnHand,
      });
      this.items.update((rows) =>
        rows.map((row) => (row.productId === item.productId ? { ...row, onHand: nextOnHand } : row)),
      );
    } catch (error) {
      const httpError = this.unwrapError(error);
      const detail = String(httpError?.error?.detail ?? '').toLowerCase();
      const rowMessage = detail.includes('product not found for tenant catalog template')
        ? 'El producto no existe en el catálogo del tenant.'
        : this.toUiErrorMessage(error);
      this.rowErrors.update((errors) => ({ ...errors, [item.productId]: rowMessage }));
    }
  }

  async saveSettings() {
    this.globalError.set(this.getPlatformTenantRequiredError());
    if (this.globalError()) {
      return;
    }

    const payload: PosInventorySettingsDto = {
      showOnlyInStock: this.showOnlyInStockControl.value,
    };

    try {
      await this.api.updateInventorySettings(payload);
      this.snapshotService.invalidate(this.storeContext.getActiveStoreId() ?? undefined);
    } catch (error) {
      this.globalError.set(this.toUiErrorMessage(error));
    }
  }

  private getPlatformTenantRequiredError() {
    if (this.authService.hasRole('SuperAdmin') && !this.tenantContext.getSelectedTenantId()) {
      return 'Selecciona Tenant en Plataforma para usar endpoints POS operativos.';
    }

    return null;
  }

  private toUiErrorMessage(error: unknown) {
    const httpError = this.unwrapError(error);
    if (httpError?.status === 400) {
      return 'Tenant requerido. Selecciona Tenant en Plataforma.';
    }

    if (httpError?.status === 403) {
      return 'La sucursal no pertenece al tenant seleccionado.';
    }

    return 'No fue posible procesar la solicitud de inventario.';
  }

  private unwrapError(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      return error;
    }

    if (typeof error === 'object' && error && 'error' in error) {
      const nested = (error as { error?: unknown }).error;
      if (nested instanceof HttpErrorResponse) {
        return nested;
      }
    }

    return null;
  }
}
