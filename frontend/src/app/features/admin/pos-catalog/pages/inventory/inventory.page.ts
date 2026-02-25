import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [ReactiveFormsModule],
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
                <td>{{ row.reason }}</td>
                <td>{{ row.note ?? '—' }}</td>
                <td>{{ row.performedByUserId }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">Sin movimientos.</td>
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
  ];

  readonly items = signal<InventoryRow[]>([]);
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
