import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CatalogInventoryAdjustmentDto,
  CatalogInventoryItemDto,
  CatalogItemType,
  CreateCatalogInventoryAdjustmentRequest,
  InventoryAdjustmentReason,
} from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import {
  ListCatalogInventoryAdjustmentsQuery,
  PosInventoryAdjustmentsApiService,
} from '../../services/pos-inventory-adjustments-api.service';
import { toInventoryAdjustmentReasonUi } from './inventory-adjustment-reason.util';
import { AuthService } from '../../../../auth/services/auth.service';
import { PlatformTenantContextService } from '../../../../platform/services/platform-tenant-context.service';

interface InventoryRow {
  itemType: Extract<CatalogItemType, 'Product' | 'Extra'>;
  itemId: string;
  itemName: string;
  itemSku?: string | null;
  isInventoryTracked: boolean;
  stockOnHandQty: number;
}

interface ItemOption {
  id: string;
  name: string;
  sku?: string | null;
}

@Component({
  selector: 'app-pos-inventory-page',
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="inventory-page" data-testid="inventory-page">
      <h2>Inventory Lite</h2>

      @if (tenantRequiredError(); as tenantError) {
        <p class="error" role="alert" data-testid="inventory-tenant-required">{{ tenantError }}</p>
      }

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

      <section class="card">
        <h3>Stock actual</h3>
        <table data-testid="inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Tipo</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (row of items(); track row.itemType + '-' + row.itemId) {
              <tr [attr.data-testid]="'inventory-row-' + row.itemType + '-' + row.itemId">
                <td>{{ row.itemName }}</td>
                <td>{{ row.itemType }}</td>
                <td>
                  <input
                    type="number"
                    [attr.data-testid]="'inventory-stock-input-' + row.itemType + '-' + row.itemId"
                    [value]="getDraftStock(row)"
                    (input)="setDraftStock(row, $any($event.target).value)"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    [attr.data-testid]="'inventory-save-' + row.itemType + '-' + row.itemId"
                    [disabled]="isSavingRow(row)"
                    (click)="saveInventoryRow(row)"
                  >
                    {{ isSavingRow(row) ? 'Guardando...' : 'Guardar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">Sin resultados.</td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <form class="card" data-testid="inventory-adjust-form" (ngSubmit)="submitAdjustment()">
        <h3>Nuevo ajuste</h3>
        <label>
          StoreId
          <input data-testid="inventory-adjust-store" [formControl]="adjustStoreIdControl" />
        </label>
        <label>
          Tipo
          <select data-testid="inventory-adjust-item-type" [formControl]="adjustItemTypeControl">
            <option value="Product">Product</option>
            <option value="Extra">Extra</option>
          </select>
        </label>
        <label>
          Item
          <select data-testid="inventory-adjust-item" [formControl]="adjustItemIdControl">
            @for (item of availableItems(); track item.id) {
              <option [value]="item.id">{{ item.name }}</option>
            }
          </select>
        </label>
        <label>
          Delta
          <input type="number" data-testid="inventory-adjust-delta" [formControl]="adjustDeltaControl" />
        </label>
        <label>
          Reason
          <select data-testid="inventory-adjust-reason" [formControl]="adjustReasonControl">
            @for (reason of adjustmentReasons; track reason) {
              <option [value]="reason">{{ reason }}</option>
            }
          </select>
        </label>
        <label>
          Nota
          <input data-testid="inventory-adjust-note" [formControl]="adjustNoteControl" />
        </label>
        <button type="submit" data-testid="inventory-adjust-submit" [disabled]="adjustBusy()">
          {{ adjustBusy() ? 'Guardando...' : 'Registrar ajuste' }}
        </button>
        @if (adjustErrorReason(); as reasonError) {
          <p class="error" role="alert" data-testid="inventory-adjust-error">{{ reasonError }}</p>
        }
        @if (adjustSuccess(); as success) {
          <p class="success" data-testid="inventory-adjust-success">{{ success }}</p>
        }
      </form>

      <section class="card">
        <h3>Historial de movimientos</h3>
        <div class="filters">
          <input
            placeholder="storeId"
            [formControl]="historyStoreIdControl"
            data-testid="inventory-history-filter-store"
          />
          <select [formControl]="historyItemTypeControl" data-testid="inventory-history-filter-itemType">
            <option value="">Todos</option>
            <option value="Product">Product</option>
            <option value="Extra">Extra</option>
          </select>
          <input
            placeholder="itemId"
            [formControl]="historyItemIdControl"
            data-testid="inventory-history-filter-itemId"
          />
          <select [formControl]="historyReasonControl" data-testid="inventory-history-filter-reason">
            <option value="">Todos motivos</option>
            @for (reason of adjustmentReasons; track reason) {
              <option [value]="reason">{{ toReasonUi(reason).label }}</option>
            }
          </select>
          <input type="datetime-local" [formControl]="historyFromUtcControl" data-testid="inventory-history-filter-fromUtc" />
          <input type="datetime-local" [formControl]="historyToUtcControl" data-testid="inventory-history-filter-toUtc" />
          <button type="button" (click)="loadHistory()" data-testid="inventory-history-filter-submit">Filtrar</button>
        </div>

        <table data-testid="inventory-history-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Item</th>
              <th>Antes</th>
              <th>Delta</th>
              <th>Después</th>
              <th>Motivo</th>
              <th>Referencia</th>
              <th>Nota</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            @for (row of historyRows(); track row.id) {
              <tr [attr.data-testid]="'inventory-history-row-' + row.id">
                <td>{{ row.createdAtUtc }}</td>
                <td>{{ row.itemName ?? row.itemId }}</td>
                <td>{{ row.qtyBefore }}</td>
                <td>{{ row.qtyDelta }}</td>
                <td>{{ row.qtyAfter }}</td>
                <td>
                  <span [attr.data-testid]="'inventory-history-movement-kind-' + row.id">{{ toReasonUi(row.reason, row.movementKind).label }}</span>
                  @if (toReasonUi(row.reason, row.movementKind).badgeKind === 'sale-consumption') {
                    <span data-testid="inventory-history-badge-sale-consumption" class="reason-badge sale">Venta</span>
                  } @else if (toReasonUi(row.reason, row.movementKind).badgeKind === 'void-reversal') {
                    <span data-testid="inventory-history-badge-void-reversal" class="reason-badge void">Void</span>
                  } @else if (toReasonUi(row.reason, row.movementKind).badgeKind === 'unknown') {
                    <span data-testid="inventory-history-badge-unknown" class="reason-badge unknown">Otro</span>
                  }
                </td>
                <td [attr.data-testid]="'inventory-history-reference-' + row.id">{{ getReferenceText(row) }}</td>
                <td>{{ row.note ?? '—' }}</td>
                <td>{{ row.performedByUserId }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9">Sin movimientos.</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </section>
  `,
  styles: `
    .inventory-page { display: flex; flex-direction: column; gap: 1rem; }
    .card { border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 0.5rem; }
    .error { color: #b91c1c; }
    .success { color: #15803d; }
    .filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
    .reason-badge { margin-left: 0.5rem; border-radius: 999px; padding: 0.1rem 0.4rem; font-size: 0.75rem; }
    .reason-badge.sale { background: #e0f2fe; color: #075985; }
    .reason-badge.void { background: #dcfce7; color: #166534; }
    .reason-badge.unknown { background: #f1f5f9; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private readonly api = inject(PosInventoryAdminApiService);
  private readonly catalogApi = inject(PosCatalogApiService);
  private readonly adjustmentsApi = inject(PosInventoryAdjustmentsApiService);
  private readonly authService = inject(AuthService);
  private readonly tenantContext = inject(PlatformTenantContextService);

  readonly adjustmentReasons: InventoryAdjustmentReason[] = [
    'InitialLoad',
    'Purchase',
    'Return',
    'Waste',
    'Damage',
    'Correction',
    'TransferIn',
    'TransferOut',
    'ManualCount',
    'SaleConsumption',
    'VoidReversal',
  ];

  readonly items = signal<InventoryRow[]>([]);
  readonly stockDrafts = signal<Record<string, string>>({});
  readonly stockSaving = signal<Record<string, boolean>>({});
  readonly historyRows = signal<CatalogInventoryAdjustmentDto[]>([]);
  readonly products = signal<ItemOption[]>([]);
  readonly extras = signal<ItemOption[]>([]);
  readonly globalError = signal<string | null>(null);
  readonly adjustErrorReason = signal<string | null>(null);
  readonly adjustSuccess = signal<string | null>(null);
  readonly adjustBusy = signal(false);

  readonly availableItems = computed(() =>
    this.adjustItemTypeControl.value === 'Extra' ? this.extras() : this.products(),
  );

  readonly storeIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly adjustStoreIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly adjustItemTypeControl = new FormControl<'Product' | 'Extra'>('Product', { nonNullable: true });
  readonly adjustItemIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly adjustDeltaControl = new FormControl(0, { nonNullable: true, validators: [Validators.required] });
  readonly adjustReasonControl = new FormControl<InventoryAdjustmentReason>('Correction', { nonNullable: true });
  readonly adjustNoteControl = new FormControl('', { nonNullable: true });

  readonly historyStoreIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly historyItemTypeControl = new FormControl<'Product' | 'Extra' | ''>('', { nonNullable: true });
  readonly historyItemIdControl = new FormControl('', { nonNullable: true });
  readonly historyFromUtcControl = new FormControl('', { nonNullable: true });
  readonly historyToUtcControl = new FormControl('', { nonNullable: true });
  readonly historyReasonControl = new FormControl('', { nonNullable: true });

  readonly tenantRequiredError = computed(() => {
    if (!this.authService.hasRole('SuperAdmin')) {
      return '';
    }

    return this.tenantContext.getSelectedTenantId() ? '' : 'Selecciona Tenant en Plataforma para operar POS Admin.';
  });

  constructor() {
    void this.loadCatalogItems();
    void this.loadInventory();
    void this.loadHistory();
  }

  async loadInventory() {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      this.globalError.set('Selecciona una sucursal para consultar inventario.');
      return;
    }

    this.adjustStoreIdControl.setValue(storeId);
    this.historyStoreIdControl.setValue(storeId);
    this.globalError.set(null);

    try {
      const response = await this.api.listInventory(storeId);
      this.items.set(
        response
          .filter((item) => item.itemType === 'Product' || item.itemType === 'Extra')
          .map((item) => this.toRow(item)),
      );
    } catch (error) {
      this.globalError.set(this.toUiError(error));
    }
  }


  getDraftStock(row: InventoryRow) {
    const key = this.getRowKey(row);
    return this.stockDrafts()[key] ?? `${row.stockOnHandQty}`;
  }

  setDraftStock(row: InventoryRow, value: string) {
    const key = this.getRowKey(row);
    this.stockDrafts.update((state) => ({ ...state, [key]: value }));
  }

  isSavingRow(row: InventoryRow) {
    return this.stockSaving()[this.getRowKey(row)] ?? false;
  }

  async saveInventoryRow(row: InventoryRow) {
    const rowKey = this.getRowKey(row);
    const parsedQty = Number.parseInt(this.getDraftStock(row), 10);
    if (!Number.isFinite(parsedQty)) {
      this.globalError.set('Cantidad inválida para inventario.');
      return;
    }

    this.stockSaving.update((state) => ({ ...state, [rowKey]: true }));
    try {
      await this.api.upsertInventory({
        storeId: this.storeIdControl.value.trim(),
        itemType: row.itemType,
        itemId: row.itemId,
        onHandQty: parsedQty,
      });
      this.items.update((rows) =>
        rows.map((current) =>
          this.getRowKey(current) === rowKey ? { ...current, stockOnHandQty: parsedQty } : current,
        ),
      );
      this.stockDrafts.update((state) => ({ ...state, [rowKey]: `${parsedQty}` }));
    } catch (error) {
      this.globalError.set(this.toUiError(error));
    } finally {
      this.stockSaving.update((state) => ({ ...state, [rowKey]: false }));
    }
  }

  async submitAdjustment() {
    this.adjustSuccess.set(null);
    this.adjustErrorReason.set(null);
    if (
      this.adjustStoreIdControl.invalid ||
      this.adjustItemIdControl.invalid ||
      this.adjustDeltaControl.value === 0
    ) {
      this.adjustErrorReason.set('ValidationError');
      return;
    }

    const payload: CreateCatalogInventoryAdjustmentRequest = {
      storeId: this.adjustStoreIdControl.value.trim(),
      itemType: this.adjustItemTypeControl.value,
      itemId: this.adjustItemIdControl.value,
      quantityDelta: this.adjustDeltaControl.value,
      reason: this.adjustReasonControl.value,
      note: this.adjustNoteControl.value.trim() || null,
      clientOperationId: globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`,
    };

    this.adjustBusy.set(true);
    try {
      await this.adjustmentsApi.createAdjustment(payload);
      this.adjustSuccess.set('AdjustmentCreated');
      await this.loadHistory();
      await this.loadInventory();
    } catch (error) {
      this.adjustErrorReason.set(this.toUiErrorReason(error));
    } finally {
      this.adjustBusy.set(false);
    }
  }

  async loadHistory() {
    const storeId = this.historyStoreIdControl.value.trim();
    if (!storeId) {
      return;
    }

    const query: ListCatalogInventoryAdjustmentsQuery = {
      storeId,
      itemType: this.historyItemTypeControl.value || undefined,
      itemId: this.historyItemIdControl.value.trim() || undefined,
      fromUtc: this.historyFromUtcControl.value.trim() || undefined,
      toUtc: this.historyToUtcControl.value.trim() || undefined,
      reason: this.historyReasonControl.value.trim() || undefined,
    };

    try {
      const rows = await this.adjustmentsApi.listAdjustments(query);
      this.historyRows.set(rows);
    } catch (error) {
      this.globalError.set(this.toUiError(error));
    }
  }

  private async loadCatalogItems() {
    const [products, extras] = await Promise.all([
      this.catalogApi.getProducts(true),
      this.catalogApi.getExtras(true),
    ]);
    this.products.set(products.map((item) => ({ id: item.id, name: item.name, sku: item.externalCode })));
    this.extras.set(extras.map((item) => ({ id: item.id, name: item.name })));

    const firstProductId = this.products()[0]?.id;
    if (firstProductId) {
      this.adjustItemIdControl.setValue(firstProductId);
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

  private getRowKey(row: InventoryRow) {
    return `${row.itemType}-${row.itemId}`;
  }

  toReasonUi(reason: string | null | undefined, movementKind?: string | null) {
    return toInventoryAdjustmentReasonUi(reason, movementKind);
  }

  getReferenceText(row: CatalogInventoryAdjustmentDto) {
    if (row.referenceType && row.referenceId) {
      return `${row.referenceType}: ${row.referenceId}`;
    }

    return row.reference || '—';
  }

  private toUiError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Solicitud inválida para inventory lite.';
    }

    return 'No fue posible procesar la solicitud de inventario.';
  }

  private toUiErrorReason(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return String(error.error?.reason ?? 'Conflict');
    }

    return 'RequestFailed';
  }
}
