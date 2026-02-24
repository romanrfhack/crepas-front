import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogInventoryItemDto, CatalogItemType } from '../../models/pos-catalog.models';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';

interface InventoryRow {
  itemType: Extract<CatalogItemType, 'Product' | 'Extra'>;
  itemId: string;
  itemName: string;
  itemSku?: string | null;
  isInventoryTracked: boolean;
  stockOnHandQty: number;
}

@Component({
  selector: 'app-pos-inventory-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="inventory-page" data-testid="inventory-page">
      <h2>Inventory Lite</h2>

      <label for="inventory-store-id">Sucursal</label>
      <input
        id="inventory-store-id"
        [formControl]="storeIdControl"
        data-testid="inventory-store-select"
        placeholder="store-id"
      />
      <button type="button" (click)="loadInventory()">Cargar</button>

      @if (globalError(); as error) {
        <p class="error" role="alert" data-testid="inventory-error">{{ error }}</p>
      }

      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Nombre</th>
            <th>SKU</th>
            <th>Tracked</th>
            <th>Stock</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.itemType + '-' + item.itemId) {
            @let rowKey = item.itemType + '-' + item.itemId;
            <tr [attr.data-testid]="'inventory-row-' + item.itemType + '-' + item.itemId">
              <td>{{ item.itemType }}</td>
              <td>{{ item.itemName }}</td>
              <td>{{ item.itemSku ?? '—' }}</td>
              <td>{{ item.isInventoryTracked ? 'Sí' : 'No' }}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  [disabled]="isRowBusy(rowKey)"
                  [value]="readDraft(rowKey, item.stockOnHandQty)"
                  (input)="updateDraft(rowKey, $event)"
                  [attr.data-testid]="'inventory-stock-input-' + item.itemType + '-' + item.itemId"
                />
              </td>
              <td>
                <button
                  type="button"
                  [disabled]="isRowBusy(rowKey)"
                  (click)="saveRow(item)"
                  [attr.data-testid]="'inventory-save-' + item.itemType + '-' + item.itemId"
                >
                  @if (isRowBusy(rowKey)) {Guardando...} @else {Guardar}
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
    .inventory-page { display: flex; flex-direction: column; gap: 1rem; }
    .error { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private readonly api = inject(PosInventoryAdminApiService);

  readonly items = signal<InventoryRow[]>([]);
  readonly globalError = signal<string | null>(null);
  readonly rowErrors = signal<Record<string, string>>({});
  readonly rowBusy = signal<Record<string, boolean>>({});
  readonly stockDrafts = signal<Record<string, number>>({});

  readonly storeIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    void this.loadInventory();
  }

  async loadInventory() {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.globalError.set('Selecciona una sucursal para consultar inventario.');
      return;
    }

    this.globalError.set(null);
    try {
      const response = await this.api.listInventory(storeId);
      const rows = response
        .filter((item) => item.itemType === 'Product' || item.itemType === 'Extra')
        .map((item) => this.toRow(item));
      this.items.set(rows);
      this.stockDrafts.set(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[this.getRowKey(row)] = row.stockOnHandQty;
          return acc;
        }, {}),
      );
    } catch (error) {
      this.globalError.set(this.toUiError(error));
    }
  }

  readDraft(rowKey: string, fallback: number) {
    return this.stockDrafts()[rowKey] ?? fallback;
  }

  updateDraft(rowKey: string, event: Event) {
    const value = Number((event.target as HTMLInputElement).value ?? 0);
    this.stockDrafts.update((state) => ({ ...state, [rowKey]: Number.isFinite(value) ? value : 0 }));
  }

  isRowBusy(rowKey: string) {
    return this.rowBusy()[rowKey] === true;
  }

  async saveRow(item: InventoryRow) {
    const rowKey = this.getRowKey(item);
    const nextStock = this.readDraft(rowKey, item.stockOnHandQty);
    if (nextStock < 0) {
      this.setRowError(rowKey, 'La existencia no puede ser negativa.');
      return;
    }

    this.setRowBusy(rowKey, true);
    this.setRowError(rowKey, '');
    const previousStock = item.stockOnHandQty;
    this.patchRowStock(item.itemType, item.itemId, nextStock);

    try {
      await this.api.upsertInventory({
        storeId: this.storeIdControl.value.trim(),
        itemType: item.itemType,
        itemId: item.itemId,
        onHandQty: nextStock,
      });
    } catch (error) {
      this.patchRowStock(item.itemType, item.itemId, previousStock);
      this.setRowError(rowKey, this.toUiError(error));
    } finally {
      this.setRowBusy(rowKey, false);
    }
  }

  private toRow(item: CatalogInventoryItemDto): InventoryRow {
    return {
      itemType: item.itemType as 'Product' | 'Extra',
      itemId: item.itemId,
      itemName: item.itemName ?? item.itemId,
      itemSku: item.itemSku,
      isInventoryTracked: item.isInventoryTracked ?? true,
      stockOnHandQty: item.onHandQty,
    };
  }

  private patchRowStock(itemType: 'Product' | 'Extra', itemId: string, stockOnHandQty: number) {
    this.items.update((rows) =>
      rows.map((row) =>
        row.itemType === itemType && row.itemId === itemId ? { ...row, stockOnHandQty } : row,
      ),
    );
  }

  private setRowBusy(rowKey: string, busy: boolean) {
    this.rowBusy.update((state) => ({ ...state, [rowKey]: busy }));
  }

  private setRowError(rowKey: string, message: string) {
    this.rowErrors.update((state) => ({ ...state, [rowKey]: message }));
  }

  private getRowKey(item: Pick<InventoryRow, 'itemType' | 'itemId'>) {
    return `${item.itemType}-${item.itemId}`;
  }

  private toUiError(error: unknown) {
    const httpError = error instanceof HttpErrorResponse ? error : null;
    if (httpError?.status === 400) {
      const detail = String(httpError.error?.detail ?? '').toLowerCase();
      if (detail.includes('optionitem')) {
        return 'OptionItem no es inventariable en Inventory Lite.';
      }

      return 'Solicitud inválida para inventory lite.';
    }

    return 'No fue posible procesar la solicitud de inventario.';
  }
}
