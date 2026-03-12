import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  CatalogInventoryAdjustmentDto,
  CatalogInventoryItemDto,
  CatalogItemType,
  CreateCatalogInventoryAdjustmentRequest,
  CreateInventoryAdjustmentV2Request,
  InventoryAdjustmentReason,
  InventoryBalanceRowDto,
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
import { environment } from '../../../../../../environments/environment';
import { InventoryFacadeService } from './inventory-facade.service';
import { InventoryAdjustmentDialogComponent } from './inventory-adjustment-dialog.component';

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
  imports: [FormsModule, ReactiveFormsModule, InventoryAdjustmentDialogComponent],
  template: `
    <section class="inventory-page" data-testid="inventory-page">
      <h2>Inventario Lite</h2>

      @if (hasContextBadge()) {
        <p data-testid="inventory-context-badge" class="context-badge">
          Contexto activo: {{ contextBadgeLabel() }}
        </p>
      }

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

      @if (inventoryV2Enabled) {
        <section class="card" data-testid="inventory-v2-panel">
          <h3>Inventory V2</h3>
          <div class="filters">
            <input data-testid="inventory-v2-search" placeholder="Buscar SKU/nombre" (input)="onInventoryV2Search($any($event.target).value)" />
            <select data-testid="inventory-v2-tracked" (change)="onInventoryV2TrackedChange($any($event.target).value)">
              <option value="">Todos</option>
              <option value="true">Tracked</option>
              <option value="false">No tracked</option>
            </select>
            <input data-testid="inventory-v2-category" placeholder="category-id" (change)="onInventoryV2CategoryChange($any($event.target).value)" />
          </div>
          <button type="button" data-testid="inventory-v2-load" (click)="loadInventoryV2()">Cargar grid</button>
          @if (inventoryV2Loading()) {
            <p data-testid="inventory-v2-loading">Cargando inventario...</p>
          } @else if (inventoryV2Error(); as inventoryV2Error) {
            <p class="error" data-testid="inventory-v2-error">{{ inventoryV2Error }}</p>
            <button type="button" data-testid="inventory-v2-retry" (click)="loadInventoryV2()">Reintentar</button>
          } @else {
            <table data-testid="inventory-v2-table">
              <thead><tr><th>SKU</th><th>Nombre</th><th>Tipo</th><th>Categoría</th><th>Tracked</th><th>OnHand</th><th>Acciones</th></tr></thead>
              <tbody>
                @for (row of inventoryV2Rows(); track row.itemType + '-' + row.itemId) {
                  <tr><td>{{ row.sku ?? '—' }}</td><td>{{ row.name }}</td><td>{{ row.itemType }}</td><td>{{ row.categoryName ?? '—' }}</td><td>{{ row.isInventoryTracked ? 'Sí' : 'No' }}</td><td>{{ formatQty(row.onHandQty) }}</td><td><button type="button" [disabled]="!row.isInventoryTracked" [attr.data-testid]="'inventory-v2-adjust-' + row.itemType + '-' + row.itemId" (click)="openAdjustmentDialog(row)">Ajustar</button><button type="button" [attr.data-testid]="'inventory-v2-kardex-' + row.itemType + '-' + row.itemId" (click)="openMovementsDrawer(row)">Ver Kardex</button></td></tr>
                } @empty {
                  <tr><td colspan="7" data-testid="inventory-v2-empty">Sin resultados.</td></tr>
                }
              </tbody>
            </table>
            <div>
              <button type="button" data-testid="inventory-v2-prev" (click)="inventoryV2PreviousPage()">Anterior</button>
              <button type="button" data-testid="inventory-v2-next" (click)="inventoryV2NextPage()">Siguiente</button>
              <span data-testid="inventory-v2-total">Total: {{ inventoryV2TotalCount() }}</span>
            </div>
          }
        </section>
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
                    step="0.001"
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


      @if (adjustmentDialogOpen() && selectedAdjustmentRow(); as selectedRow) {
        <app-inventory-adjustment-dialog
          [row]="selectedRow"
          [storeId]="storeIdControl.value"
          (dismissed)="closeAdjustmentDialog()"
          (confirm)="submitInventoryV2Adjustment($event)"
        />
        @if (adjustRetryAvailable()) {
          <button type="button" data-testid="inventory-v2-adjust-retry" (click)="retryLastInventoryV2Adjustment()">Reintentar último ajuste</button>
        }
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


      @if (movementsDrawerOpen() && movementContext(); as context) {
        <section class="card" data-testid="inventory-movements-drawer">
          <h3>Kardex · {{ context.itemSku ?? '—' }} {{ context.itemName }}</h3>
          <p data-testid="inventory-movements-header">Store: {{ context.storeId }} · OnHand: {{ formatQty(context.onHandQty) }}</p>
          <div class="filters">
            <input type="datetime-local" data-testid="inventory-movements-from" (change)="onMovementFromChange($any($event.target).value)" />
            <input type="datetime-local" data-testid="inventory-movements-to" (change)="onMovementToChange($any($event.target).value)" />
            <select data-testid="inventory-movements-reason" (change)="onMovementReasonChange($any($event.target).value)">
              <option value="">Todos motivos</option>
              @for (reason of adjustmentReasons; track reason) {
                <option [value]="reason">{{ toReasonUi(reason).label }}</option>
              }
            </select>
            <input placeholder="referenceId" data-testid="inventory-movements-reference" (input)="onMovementReferenceChange($any($event.target).value)" />
            <button type="button" data-testid="inventory-movements-close" (click)="closeMovementsDrawer()">Cerrar</button>
          </div>
          @if (movementLoading()) {
            <p data-testid="inventory-movements-loading">Cargando kardex...</p>
          } @else if (movementError(); as movementError) {
            <p class="error" data-testid="inventory-movements-error">{{ movementError }}</p>
            <button type="button" data-testid="inventory-movements-retry" (click)="reloadMovementsDrawer()">Reintentar</button>
          } @else {
            <table data-testid="inventory-movements-table">
              <thead><tr><th>Fecha/hora</th><th>Razón</th><th>Delta</th><th>Stock</th><th>Referencia</th><th>Usuario</th><th>Nota</th></tr></thead>
              <tbody>
                @for (row of movementRows(); track row.movementId) {
                  <tr>
                    <td>{{ row.occurredAtUtc }}</td>
                    <td>{{ toReasonUi(row.reasonCode).label }}</td>
                    <td>{{ formatQty(row.deltaQty) }}</td>
                    <td>{{ formatQty(row.qtyBefore) }} → {{ formatQty(row.qtyAfter) }}</td>
                    <td>{{ row.referenceType ?? '—' }} {{ row.referenceId ?? '—' }}</td>
                    <td>{{ row.createdByDisplayName ?? row.createdByUserId ?? '—' }}</td>
                    <td [title]="row.note ?? ''">{{ row.note ?? '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7">Sin movimientos.</td></tr>
                }
              </tbody>
            </table>
            <div>
              <button type="button" data-testid="inventory-movements-prev" (click)="movementPreviousPage()">Anterior</button>
              <button type="button" data-testid="inventory-movements-next" (click)="movementNextPage()">Siguiente</button>
              <span data-testid="inventory-movements-total">Total: {{ movementTotalCount() }}</span>
            </div>
          }
        </section>
      }

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
    .context-badge { width: fit-content; border-radius: 999px; background: #dbeafe; color: #1e3a8a; padding: 0.2rem 0.6rem; font-weight: 600; }
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
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryFacade = inject(InventoryFacadeService);

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
  readonly contextStoreId = signal('');
  readonly contextItemType = signal('');
  readonly contextSearch = signal('');
  readonly inventoryV2Enabled = environment.inventoryV2Enabled ?? false;

  readonly inventoryV2Rows = this.inventoryFacade.rows;
  readonly inventoryV2Loading = this.inventoryFacade.loading;
  readonly inventoryV2Error = this.inventoryFacade.error;
  readonly inventoryV2TotalCount = this.inventoryFacade.totalCount;
  readonly adjustmentDialogOpen = signal(false);
  readonly movementsDrawerOpen = this.inventoryFacade.movementsOpen;
  readonly movementContext = this.inventoryFacade.movementsContext;
  readonly movementRows = this.inventoryFacade.movementsRows;
  readonly movementTotalCount = this.inventoryFacade.movementsTotalCount;
  readonly movementLoading = this.inventoryFacade.movementsLoading;
  readonly movementError = this.inventoryFacade.movementsError;
  readonly selectedAdjustmentRow = signal<InventoryBalanceRowDto | null>(null);
  readonly lastInventoryV2Payload = signal<CreateInventoryAdjustmentV2Request | null>(null);
  readonly adjustRetryAvailable = computed(() => this.lastInventoryV2Payload() !== null && !this.adjustBusy());

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
    this.applyContextFromQueryParams();
    void this.loadCatalogItems();
    void this.loadInventory();
    void this.loadHistory();
    if (this.inventoryV2Enabled) {
      void this.loadInventoryV2();
    }
  }

  private applyContextFromQueryParams(): void {
    const storeId = this.route.snapshot.queryParamMap.get('storeId')?.trim() ?? '';
    const itemType = this.route.snapshot.queryParamMap.get('itemType')?.trim() ?? '';
    const search = this.route.snapshot.queryParamMap.get('search')?.trim() ?? '';

    this.contextStoreId.set(storeId);
    this.contextItemType.set(itemType === 'Product' || itemType === 'Extra' ? itemType : '');
    this.contextSearch.set(search);

    if (storeId) {
      this.storeIdControl.setValue(storeId);
      this.adjustStoreIdControl.setValue(storeId);
      this.historyStoreIdControl.setValue(storeId);
    }

    if (itemType === 'Product' || itemType === 'Extra') {
      this.adjustItemTypeControl.setValue(itemType);
      this.historyItemTypeControl.setValue(itemType);
    }

    if (search) {
      this.historyItemIdControl.setValue(search);
    }
  }

  async loadInventoryV2() {
    this.inventoryFacade.updateStore(this.storeIdControl.value.trim());
    await this.inventoryFacade.load();
  }

  onInventoryV2Search(value: string) {
    this.inventoryFacade.updateSearch(value);
  }

  async onInventoryV2TrackedChange(value: '' | 'true' | 'false') {
    this.inventoryFacade.updateTracked(value);
    await this.inventoryFacade.load();
  }

  async onInventoryV2CategoryChange(value: string) {
    this.inventoryFacade.updateCategory(value);
    await this.inventoryFacade.load();
  }

  async inventoryV2NextPage() {
    const currentPage = this.inventoryFacade.filters().page;
    this.inventoryFacade.updatePage(currentPage + 1);
    await this.inventoryFacade.load();
  }

  async inventoryV2PreviousPage() {
    const currentPage = this.inventoryFacade.filters().page;
    this.inventoryFacade.updatePage(Math.max(1, currentPage - 1));
    await this.inventoryFacade.load();
  }

  hasContextBadge(): boolean {
    return !!this.contextStoreId() || !!this.contextItemType() || !!this.contextSearch();
  }

  contextBadgeLabel(): string {
    const chunks = [
      this.contextStoreId() ? `Store: ${this.contextStoreId()}` : '',
      this.contextItemType() ? `Tipo: ${this.contextItemType()}` : '',
      this.contextSearch() ? `Búsqueda: ${this.contextSearch()}` : '',
    ];

    return chunks.filter((item) => !!item).join(' · ');
  }



  openMovementsDrawer(row: InventoryBalanceRowDto) {
    const storeId = this.storeIdControl.value.trim();
    if (!storeId) {
      return;
    }

    this.inventoryFacade.openMovementsDrawer({
      storeId,
      itemType: row.itemType,
      itemId: row.itemId,
      itemName: row.name,
      itemSku: row.sku,
      onHandQty: row.onHandQty,
    });
  }

  closeMovementsDrawer() {
    this.inventoryFacade.closeMovementsDrawer();
  }

  reloadMovementsDrawer() {
    void this.inventoryFacade.loadMovements();
  }

  onMovementFromChange(value: string) {
    this.inventoryFacade.updateMovementsFrom(value);
  }

  onMovementToChange(value: string) {
    this.inventoryFacade.updateMovementsTo(value);
  }

  onMovementReasonChange(value: string) {
    this.inventoryFacade.updateMovementsReason((value || '') as '' | InventoryAdjustmentReason);
  }

  onMovementReferenceChange(value: string) {
    this.inventoryFacade.updateMovementsReference(value);
  }

  async movementPreviousPage() {
    const current = this.inventoryFacade.movementsFilters().page;
    this.inventoryFacade.updateMovementsPage(Math.max(1, current - 1));
    await this.inventoryFacade.loadMovements();
  }

  async movementNextPage() {
    const current = this.inventoryFacade.movementsFilters().page;
    this.inventoryFacade.updateMovementsPage(current + 1);
    await this.inventoryFacade.loadMovements();
  }

  openAdjustmentDialog(row: InventoryBalanceRowDto) {
    this.adjustErrorReason.set(null);
    this.adjustSuccess.set(null);
    this.selectedAdjustmentRow.set(row);
    this.adjustmentDialogOpen.set(true);
  }

  closeAdjustmentDialog() {
    this.adjustmentDialogOpen.set(false);
    this.selectedAdjustmentRow.set(null);
  }

  async submitInventoryV2Adjustment(input: { operationType: 'Delta' | 'Set'; quantity: number; reasonCode: InventoryAdjustmentReason; reference: string | null; note: string | null }) {
    const row = this.selectedAdjustmentRow();
    const storeId = this.storeIdControl.value.trim();
    if (!row || !storeId) {
      return;
    }

    const clientOperationId = globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
    const payload: CreateInventoryAdjustmentV2Request = {
      storeId,
      itemType: row.itemType,
      itemId: row.itemId,
      operationType: input.operationType,
      quantityDelta: input.operationType === 'Delta' ? input.quantity : null,
      quantitySet: input.operationType === 'Set' ? input.quantity : null,
      reasonCode: input.reasonCode,
      reference: input.reference,
      note: input.note,
      clientOperationId,
      expectedVersion: input.operationType === 'Set' ? (row.balanceVersion ?? null) : null,
    };

    this.lastInventoryV2Payload.set(payload);
    await this.executeInventoryV2Adjustment(payload, true);
  }

  async retryLastInventoryV2Adjustment() {
    const payload = this.lastInventoryV2Payload();
    if (!payload) {
      return;
    }

    await this.executeInventoryV2Adjustment(payload, false);
  }

  private async executeInventoryV2Adjustment(payload: CreateInventoryAdjustmentV2Request, closeDialogOnSuccess: boolean) {
    this.adjustBusy.set(true);
    this.adjustErrorReason.set(null);
    this.adjustSuccess.set(null);

    try {
      const result = await this.api.createInventoryAdjustmentV2(payload);
      this.adjustSuccess.set('AdjustmentCreated');
      this.inventoryFacade.invalidate();
      await this.loadInventoryV2();
      await this.loadHistory();
      if (closeDialogOnSuccess) {
        this.closeAdjustmentDialog();
      }
      this.inventoryFacade.patchRow(result.itemType, result.itemId, result.qtyAfter, result.balanceVersion);
    } catch (error) {
      const reason = this.toUiErrorReason(error);
      this.adjustErrorReason.set(reason);
      if (reason === 'CONCURRENCY_CONFLICT') {
        this.inventoryFacade.invalidate();
        await this.loadInventoryV2();
      }
    } finally {
      this.adjustBusy.set(false);
    }
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
    return this.stockDrafts()[key] ?? this.formatQty(row.stockOnHandQty);
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
    const parsedQty = this.parseQty(this.getDraftStock(row));
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
      this.stockDrafts.update((state) => ({ ...state, [rowKey]: this.formatQty(parsedQty) }));
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

  private parseQty(value: string) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return Number.NaN;
    }

    return Math.round(parsed * 1000) / 1000;
  }

  formatQty(value: number) {
    return value.toFixed(3);
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
    if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 400)) {
      return String(error.error?.reason ?? 'VALIDATION_ERROR');
    }

    return 'REQUEST_FAILED';
  }
}
