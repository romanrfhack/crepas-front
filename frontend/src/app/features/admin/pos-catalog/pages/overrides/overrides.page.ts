import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import {
  CatalogItemOverrideDto,
  CatalogItemType,
  PosAdminCatalogOverridesApiService,
} from '../../services/pos-admin-catalog-overrides-api.service';

type OverrideUiState = 'Enabled' | 'Disabled' | 'None';

interface OverrideRow {
  itemType: CatalogItemType;
  itemId: string;
  itemName: string;
  itemSku?: string | null;
  state: OverrideUiState;
}

@Component({
  selector: 'app-pos-catalog-overrides-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="page" data-testid="store-overrides-page">
      <h2>Store Overrides</h2>
      <p>Configura disponibilidad explícita por sucursal para Products, Extras y Option Items.</p>

      <label for="override-store-id">Sucursal</label>
      <input
        id="override-store-id"
        [formControl]="storeIdControl"
        data-testid="store-override-store-select"
        placeholder="store-id"
      />
      <button type="button" (click)="loadRows()">Cargar</button>

      @if (errorMessage(); as error) {
        <p class="error" role="alert" data-testid="store-override-error">{{ error }}</p>
      }

      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Nombre</th>
            <th>Estado override</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.itemType + '-' + row.itemId) {
            @let rowKey = row.itemType + '-' + row.itemId;
            <tr [attr.data-testid]="'store-override-row-' + row.itemType + '-' + row.itemId">
              <td>{{ row.itemType }}</td>
              <td>
                {{ row.itemName }}
                @if (row.itemSku) {
                  <span>({{ row.itemSku }})</span>
                }
              </td>
              <td [attr.data-testid]="'store-override-state-' + row.itemType + '-' + row.itemId">
                {{ overrideStateLabel(row.state) }}
              </td>
              <td>
                <button
                  type="button"
                  [disabled]="isRowBusy(rowKey)"
                  [attr.data-testid]="'store-override-enable-' + row.itemType + '-' + row.itemId"
                  (click)="setState(row, 'Enabled')"
                >
                  @if (isRowBusy(rowKey)) {Guardando...} @else {Enabled}
                </button>
                <button
                  type="button"
                  [disabled]="isRowBusy(rowKey)"
                  [attr.data-testid]="'store-override-disable-' + row.itemType + '-' + row.itemId"
                  (click)="setState(row, 'Disabled')"
                >
                  @if (isRowBusy(rowKey)) {Guardando...} @else {Disabled}
                </button>
                <button
                  type="button"
                  [disabled]="isRowBusy(rowKey)"
                  [attr.data-testid]="'store-override-clear-' + row.itemType + '-' + row.itemId"
                  (click)="clearOverride(row)"
                >
                  @if (isRowBusy(rowKey)) {Guardando...} @else {Sin override}
                </button>
                @if (rowErrors()[rowKey]; as rowError) {
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
    .page { display: flex; flex-direction: column; gap: 0.75rem; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
    .error { color: #b91c1c; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverridesPage {
  private readonly catalogApi = inject(PosCatalogApiService);
  private readonly overridesApi = inject(PosAdminCatalogOverridesApiService);

  readonly storeIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly rows = signal<OverrideRow[]>([]);
  readonly rowBusy = signal<Record<string, boolean>>({});
  readonly rowErrors = signal<Record<string, string>>({});
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    void this.loadRows();
  }

  async loadRows() {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.errorMessage.set('Selecciona una sucursal para gestionar overrides.');
      return;
    }

    this.errorMessage.set(null);
    try {
      const [products, extras, optionRows] = await Promise.all([
        this.catalogApi.getProducts(true),
        this.catalogApi.getExtras(true),
        this.loadOptionItems(),
      ]);
      const overrides = await this.overridesApi.listOverrides(storeId, undefined, false);
      const overrideLookup = this.toOverrideLookup(overrides);

      const nextRows: OverrideRow[] = [
        ...products.map((item) => ({
          itemType: 'Product' as const,
          itemId: item.id,
          itemName: item.name,
          itemSku: item.externalCode,
          state: this.resolveRowState('Product', item.id, overrideLookup),
        })),
        ...extras.map((item) => ({
          itemType: 'Extra' as const,
          itemId: item.id,
          itemName: item.name,
          state: this.resolveRowState('Extra', item.id, overrideLookup),
        })),
        ...optionRows.map((item) => ({
          itemType: 'OptionItem' as const,
          itemId: item.id,
          itemName: item.name,
          state: this.resolveRowState('OptionItem', item.id, overrideLookup),
        })),
      ];

      this.rows.set(nextRows);
    } catch (error) {
      this.errorMessage.set(this.toUiError(error));
    }
  }

  overrideStateLabel(state: OverrideUiState) {
    if (state === 'None') {
      return 'Sin override';
    }

    return state;
  }

  isRowBusy(rowKey: string) {
    return this.rowBusy()[rowKey] === true;
  }

  async setState(row: OverrideRow, state: 'Enabled' | 'Disabled') {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.errorMessage.set('Selecciona una sucursal para gestionar overrides.');
      return;
    }

    const rowKey = this.getRowKey(row.itemType, row.itemId);
    const previousState = row.state;
    this.setRowBusy(rowKey, true);
    this.setRowError(rowKey, '');
    this.patchRowState(row.itemType, row.itemId, state);

    try {
      await this.overridesApi.upsertOverride({
        storeId,
        itemType: row.itemType,
        itemId: row.itemId,
        state,
      });
    } catch (error) {
      this.patchRowState(row.itemType, row.itemId, previousState);
      this.setRowError(rowKey, this.toUiError(error));
    } finally {
      this.setRowBusy(rowKey, false);
    }
  }

  async clearOverride(row: OverrideRow) {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.errorMessage.set('Selecciona una sucursal para gestionar overrides.');
      return;
    }

    const rowKey = this.getRowKey(row.itemType, row.itemId);
    const previousState = row.state;
    this.setRowBusy(rowKey, true);
    this.setRowError(rowKey, '');
    this.patchRowState(row.itemType, row.itemId, 'None');

    try {
      await this.overridesApi.deleteOverride(storeId, row.itemType, row.itemId);
    } catch (error) {
      this.patchRowState(row.itemType, row.itemId, previousState);
      this.setRowError(rowKey, this.toUiError(error));
    } finally {
      this.setRowBusy(rowKey, false);
    }
  }

  private async loadOptionItems() {
    const optionSets = await this.catalogApi.getOptionSets(true);
    const optionsBySet = await Promise.all(
      optionSets.map((set) => this.catalogApi.getOptionItems(set.id, true)),
    );

    return optionsBySet.flat();
  }

  private resolveRowState(
    itemType: CatalogItemType,
    itemId: string,
    lookup: Record<string, CatalogItemOverrideDto>,
  ): OverrideUiState {
    const key = this.getRowKey(itemType, itemId);
    const state = lookup[key]?.state;
    if (state === 'Enabled' || state === 'Disabled') {
      return state;
    }

    return 'None';
  }

  private toOverrideLookup(overrides: CatalogItemOverrideDto[]) {
    return overrides.reduce<Record<string, CatalogItemOverrideDto>>((acc, current) => {
      acc[this.getRowKey(current.itemType as CatalogItemType, current.itemId)] = current;
      return acc;
    }, {});
  }

  private patchRowState(itemType: CatalogItemType, itemId: string, state: OverrideUiState) {
    this.rows.update((rows) =>
      rows.map((row) => (row.itemType === itemType && row.itemId === itemId ? { ...row, state } : row)),
    );
  }

  private setRowBusy(rowKey: string, busy: boolean) {
    this.rowBusy.update((state) => ({ ...state, [rowKey]: busy }));
  }

  private setRowError(rowKey: string, message: string) {
    this.rowErrors.update((state) => ({ ...state, [rowKey]: message }));
  }

  private getRowKey(itemType: CatalogItemType, itemId: string) {
    return `${itemType}-${itemId}`;
  }

  private toUiError(error: unknown) {
    const httpError = error instanceof HttpErrorResponse ? error : null;
    if (httpError?.status === 400) {
      return 'No fue posible guardar el override. Verifica itemType y storeId.';
    }

    return 'No fue posible procesar la solicitud de store override.';
  }
}
