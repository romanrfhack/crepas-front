import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map, startWith } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CategoryListComponent } from '../components/category-list/category-list.component';
import {
  CustomizationModalComponent,
  ProductCustomizationResult,
} from '../components/customization-modal/customization-modal.component';
import { CartComponent } from '../components/cart/cart.component';
import {
  PaymentModalComponent,
  PaymentSubmitEvent,
} from '../components/payment-modal/payment-modal.component';
import { ProductGridComponent } from '../components/product-grid/product-grid.component';
import {
  CartItem,
  CloseShiftResultDto,
  CountedDenominationDto,
  CatalogSnapshotDto,
  CreateSaleRequestDto,
  PosShiftDto,
  ProductDto,
  SaleListItemUi,
  SaleResponseDto,
  SaleVoidRequestDto,
  ShiftClosePreviewDto,
} from '../models/pos.models';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { PosShiftApiService } from '../services/pos-shift-api.service';
import { PosTimezoneService } from '../services/pos-timezone.service';
import { StoreContextService } from '../services/store-context.service';

@Component({
  selector: 'app-pos-caja-page',
  imports: [
    ReactiveFormsModule,
    CategoryListComponent,
    ProductGridComponent,
    CartComponent,
    CustomizationModalComponent,
    PaymentModalComponent,
  ],
  templateUrl: './pos-caja.page.html',
  styleUrl: './pos-caja.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosCajaPage implements OnDestroy {
  private readonly snapshotService = inject(PosCatalogSnapshotService);
  private readonly salesApi = inject(PosSalesApiService);
  private readonly shiftApi = inject(PosShiftApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly timezone = inject(PosTimezoneService);
  private readonly storeContext = inject(StoreContextService);

  readonly snapshot = signal<CatalogSnapshotDto | null>(null);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly cartItems = signal<CartItem[]>([]);
  readonly activeCustomizationProduct = signal<ProductDto | null>(null);
  readonly showPayment = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canRefreshCatalogAfterUnavailable = signal(false);
  readonly unavailableItemName = signal<string | null>(null);
  readonly saleSuccess = signal<SaleResponseDto | null>(null);
  readonly currentShift = signal<PosShiftDto | null>(null);
  readonly showOpenShiftModal = signal(false);
  readonly showCloseShiftModal = signal(false);
  readonly closePreview = signal<ShiftClosePreviewDto | null>(null);
  readonly closeResult = signal<CloseShiftResultDto | null>(null);
  readonly cartExpanded = signal(false);
  readonly shiftSales = signal<SaleListItemUi[]>([]);
  readonly showVoidModal = signal(false);
  readonly selectedSaleForVoid = signal<SaleListItemUi | null>(null);
  readonly closeShiftError = signal<string | null>(null);
  readonly voidForbiddenError = signal(false);

  private autoCollapseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly correlationId = signal(crypto.randomUUID());
  readonly inProgressClientSaleId = signal<string | null>(null);
  readonly inProgressCloseOperationId = signal<string | null>(null);
  readonly inProgressVoidOperationId = signal<string | null>(null);
  readonly requireOpenShift = environment.posRequireOpenShift;
  readonly showCorrelationId = !environment.production;

  readonly denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];

  readonly openShiftForm = this.formBuilder.nonNullable.group({
    startingCashAmount: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  readonly closeShiftForm = this.formBuilder.nonNullable.group({
    reason: [''],
    evidence: [''],
    counts: this.formBuilder.array(
      this.denominations.map(() =>
        this.formBuilder.nonNullable.control(0, [
          Validators.required,
          Validators.min(0),
          Validators.pattern(/^\d+$/),
        ]),
      ),
    ),
  });

  readonly voidForm = this.formBuilder.nonNullable.group({
    reasonCode: ['CashierError', [Validators.required]],
    reasonText: [''],
    note: [''],
  });

  private readonly countsValues = toSignal(
    this.countControls.valueChanges.pipe(
      startWith(this.countControls.getRawValue()),
      map((counts) => this.normalizeCounts(counts)),
    ),
    { initialValue: this.denominations.map(() => 0) },
  );

  readonly categories = computed(
    () => this.snapshot()?.categories.filter((item) => item.isActive) ?? [],
  );
  readonly hasOpenShift = computed(
    () => this.currentShift()?.closedAtUtc == null && this.currentShift() !== null,
  );
  readonly canCheckout = computed(() => !this.requireOpenShift || this.hasOpenShift());

  readonly openedShiftSummary = computed(() => {
    const shift = this.currentShift();
    if (!shift || shift.closedAtUtc) {
      return null;
    }

    return {
      openedAt: this.timezone.formatDateTime(shift.openedAtUtc),
      openingCashAmount: shift.openingCashAmount,
    };
  });

  readonly closeExpectedAmount = computed(() => this.closePreview()?.expectedCashAmount ?? 0);

  readonly countedTotal = computed(() => this.centsToMoney(this.countedTotalCents()));

  readonly closeDifference = computed(() =>
    this.centsToMoney(this.countedTotalCents() - this.closeExpectedCents()),
  );

  readonly thresholdExceeded = computed(() => Math.abs(this.closeDifference()) > 0.009);
  readonly requiresDifferenceReason = computed(() => this.thresholdExceeded());

  readonly products = computed(() => {
    const current = this.snapshot()?.products.filter((item) => item.isActive) ?? [];
    const categoryId = this.selectedCategoryId();
    const search = this.searchTerm().trim().toLowerCase();

    return current
      .filter((product) => (categoryId ? product.categoryId === categoryId : true))
      .filter((product) => (search.length ? product.name.toLowerCase().includes(search) : true));
  });

  readonly estimatedTotal = computed(() =>
    this.round2(
      this.cartItems().reduce((acc, item) => {
        const extrasTotal = item.extras.reduce(
          (sum, extra) => sum + extra.unitPrice * extra.quantity,
          0,
        );
        const unit = item.basePrice + extrasTotal;
        return acc + unit * item.quantity;
      }, 0),
    ),
  );

  readonly customizationGroups = computed(() => {
    const product = this.activeCustomizationProduct();
    const snapshot = this.snapshot();
    if (!product?.customizationSchemaId || !snapshot) {
      return [];
    }

    return snapshot.selectionGroups.filter(
      (group) => group.schemaId === product.customizationSchemaId && group.isActive,
    );
  });

  readonly customizationOptionItems = computed(
    () => this.snapshot()?.optionItems.filter((item) => item.isActive) ?? [],
  );
  readonly customizationExtras = computed(
    () => this.snapshot()?.extras.filter((extra) => extra.isActive) ?? [],
  );

  get countControls() {
    return this.closeShiftForm.controls.counts as FormArray<FormControl<number>>;
  }

  getCountControl(index: number) {
    return this.countControls.at(index);
  }

  constructor() {
    this.storeContext.setActiveStoreId(this.storeContext.getActiveStoreId());
    void this.loadSnapshot();
    void this.loadCurrentShift();
  }

  async loadSnapshot(forceRefresh = false) {
    if (forceRefresh) {
      this.errorMessage.set(null);
      this.canRefreshCatalogAfterUnavailable.set(false);
      this.unavailableItemName.set(null);
    }
    try {
      const data = await firstValueFrom(this.snapshotService.getSnapshot({ forceRefresh }));
      this.snapshot.set(data);
    } catch {
      this.errorMessage.set('No se pudo cargar el catálogo. Intenta nuevamente.');
    }
  }

  async loadCurrentShift() {
    try {
      const shift = await this.shiftApi.getCurrentShift();
      this.currentShift.set(shift ?? null);
      this.showOpenShiftModal.set(this.requireOpenShift && !shift);
    } catch {
      this.errorMessage.set('No se pudo consultar el estado del turno.');
    }
  }

  openPaymentModal() {
    if (!this.canCheckout()) {
      this.showOpenShiftModal.set(true);
      this.errorMessage.set('Debes abrir turno para confirmar cobros.');
      return;
    }

    this.showPayment.set(true);
  }

  async submitOpenShift() {
    if (this.openShiftForm.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const { startingCashAmount, notes } = this.openShiftForm.getRawValue();
      const shift = await this.shiftApi.openShift(startingCashAmount, notes);
      this.currentShift.set(shift);
      this.showOpenShiftModal.set(false);
      this.openShiftForm.patchValue({ notes: '' });
    } catch {
      this.errorMessage.set('No se pudo abrir el turno.');
    } finally {
      this.loading.set(false);
    }
  }

  async startCloseShift() {
    if (!this.hasOpenShift() || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.closeShiftError.set(null);

    try {
      const preview = await this.shiftApi.closePreviewV2({
        shiftId: this.currentShift()?.id,
      });
      this.closePreview.set(this.normalizePreview(preview));
      this.closeResult.set(null);
      this.closeShiftForm.reset({
        reason: '',
        evidence: '',
        counts: this.denominations.map(() => 0),
      });
      this.showCloseShiftModal.set(true);
    } catch {
      this.errorMessage.set('No se pudo obtener la vista previa del cierre de turno.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshClosePreviewWithCashCount() {
    if (!this.showCloseShiftModal() || !this.currentShift()) {
      return;
    }

    try {
      const preview = await this.shiftApi.closePreviewV2({
        shiftId: this.currentShift()?.id,
        cashCount: this.buildCountedDenominations(),
      });
      this.closePreview.set(this.normalizePreview(preview));
    } catch {
      this.errorMessage.set('No se pudo recalcular el preview de cierre con el arqueo capturado.');
    }
  }

  async submitCloseShift() {
    const shift = this.currentShift();
    if (!shift || this.loading()) {
      return;
    }

    if (this.requiresDifferenceReason() && !this.closeShiftForm.controls.reason.value.trim()) {
      this.closeShiftError.set(
        'Debes capturar un motivo cuando exista diferencia en cierre de caja.',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.closeShiftError.set(null);

    const { reason, evidence } = this.closeShiftForm.getRawValue();
    const clientOperationId = this.inProgressCloseOperationId() ?? crypto.randomUUID();
    this.inProgressCloseOperationId.set(clientOperationId);

    try {
      const closeNotes = evidence?.trim() ? evidence.trim() : null;
      const closeReason = reason?.trim() ? reason.trim() : undefined;
      const result = await this.shiftApi.closeShift({
        shiftId: shift.id,
        countedDenominations: this.buildCountedDenominations(),
        closeReason,
        closingNotes: closeNotes,
        clientOperationId,
      });
      this.closeResult.set(result);
      this.currentShift.set({
        ...shift,
        closedAtUtc: result.closedAtUtc,
        closingCashAmount: result.countedCashAmount,
        closeNotes: result.closeNotes,
      });
      this.showCloseShiftModal.set(false);
      this.closeShiftError.set(null);
      this.inProgressCloseOperationId.set(null);
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      if (httpError.status === 400) {
        this.closeShiftError.set(
          'El backend requiere motivo de diferencia para finalizar el cierre.',
        );
      } else if (httpError.status === 0) {
        this.closeShiftError.set(
          'Error de red. Puedes reintentar y se reutilizará el mismo clientOperationId para evitar duplicados.',
        );
      } else {
        this.closeShiftError.set('No se pudo cerrar el turno.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.clearAutoCollapseTimer();
  }

  toggleCart() {
    this.cartExpanded.update((prev) => !prev);
  }

  onProductSelected(product: ProductDto) {
    if (!product.isAvailable) {
      return;
    }

    if (product.customizationSchemaId) {
      this.activeCustomizationProduct.set(product);
      return;
    }

    this.addToCart(product, { selections: [], extras: [] });
  }

  onConfirmCustomization(payload: ProductCustomizationResult) {
    const product = this.activeCustomizationProduct();
    if (!product) {
      return;
    }

    this.addToCart(product, payload);
    this.activeCustomizationProduct.set(null);
  }

  removeFromCart(itemId: string) {
    this.cartItems.update((items) => items.filter((item) => item.id !== itemId));
  }

  increaseQty(itemId: string) {
    this.cartItems.update((items) =>
      items.map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item)),
    );
  }

  decreaseQty(itemId: string) {
    this.cartItems.update((items) =>
      items
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async confirmPayment(event: PaymentSubmitEvent) {
    if (this.cartItems().length === 0 || this.loading()) {
      return;
    }

    if (!this.canCheckout()) {
      this.showOpenShiftModal.set(true);
      this.errorMessage.set('Debes tener un turno abierto para registrar ventas.');
      return;
    }

    this.errorMessage.set(null);
    this.canRefreshCatalogAfterUnavailable.set(false);
    this.unavailableItemName.set(null);
    this.saleSuccess.set(null);
    this.loading.set(true);

    const clientSaleId = this.inProgressClientSaleId() ?? crypto.randomUUID();
    this.inProgressClientSaleId.set(clientSaleId);

    const payload: CreateSaleRequestDto = {
      clientSaleId,
      occurredAtUtc: null,
      items: this.cartItems().map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        selections: item.selections.length
          ? item.selections.map((selection) => ({
              groupKey: selection.groupKey,
              optionItemId: selection.optionItemId,
            }))
          : null,
        extras: item.extras.length
          ? item.extras.map((extra) => ({
              extraId: extra.extraId,
              quantity: extra.quantity,
            }))
          : null,
      })),
      payments: event.payments,
      ...(this.storeContext.getActiveStoreId()
        ? { storeId: this.storeContext.getActiveStoreId()! }
        : {}),
    };

    try {
      const response = await this.salesApi.createSale(payload, this.correlationId());
      this.saleSuccess.set(response);
      this.shiftSales.update((sales) => [
        {
          saleId: response.saleId,
          folio: response.folio,
          total: response.total,
          occurredAtUtc: response.occurredAtUtc,
          status: 'Completed',
        },
        ...sales,
      ]);
      this.cartItems.set([]);
      this.showPayment.set(false);
      this.inProgressClientSaleId.set(null);
      await this.refreshClosePreviewWithCashCount();
    } catch (error) {
      console.log('[confirmPayment] Caught error:', error);
      await this.handleSaleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  openVoidModal(sale: SaleListItemUi) {
    this.selectedSaleForVoid.set(sale);
    this.voidForm.reset({
      reasonCode: 'CashierError',
      reasonText: '',
      note: '',
    });
    this.showVoidModal.set(true);
    this.voidForbiddenError.set(false);
  }

  async confirmVoidSale() {
    const sale = this.selectedSaleForVoid();
    if (!sale || this.voidForm.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.voidForbiddenError.set(false);

    const clientVoidId = this.inProgressVoidOperationId() ?? crypto.randomUUID();
    this.inProgressVoidOperationId.set(clientVoidId);

    const { reasonCode, reasonText, note } = this.voidForm.getRawValue();
    const payload: SaleVoidRequestDto = {
      reasonCode,
      reasonText: reasonText.trim() || undefined,
      note: note.trim() || undefined,
      clientVoidId,
    };

    try {
      await this.salesApi.voidSale(sale.saleId, payload, this.correlationId());
      this.shiftSales.update((sales) =>
        sales.map((current) =>
          current.saleId === sale.saleId ? { ...current, status: 'Void' } : current,
        ),
      );
      this.showVoidModal.set(false);
      this.selectedSaleForVoid.set(null);
      this.inProgressVoidOperationId.set(null);
      await this.refreshClosePreviewWithCashCount();
    } catch (error) {
      if (this.isVoidForbiddenError(error)) {
        this.voidForbiddenError.set(true);
        this.errorMessage.set(
          'No autorizado para cancelar esta venta. Solo Manager/Admin o el Cashier dueño del turno vigente pueden anularla.',
        );
      } else if (this.getHttpStatus(error) === 0) {
        this.errorMessage.set(
          'Error de red. Puedes reintentar y se reutilizará el mismo clientVoidId para evitar duplicados.',
        );
      } else {
        this.errorMessage.set('No fue posible cancelar la venta.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private buildCountedDenominations(): CountedDenominationDto[] {
    const normalizedCounts = this.normalizeCounts(this.countControls.getRawValue());

    return this.denominations
      .map((denominationValue, index) => ({
        denominationValue,
        count: normalizedCounts[index] ?? 0,
      }))
      .filter((line) => line.count > 0);
  }

  private countedTotalCents() {
    const counts = this.countsValues();
    return this.denominations.reduce((total, denomination, index) => {
      const denominationCents = this.moneyToCents(denomination);
      const count = counts[index] ?? 0;
      return total + denominationCents * count;
    }, 0);
  }

  private closeExpectedCents() {
    return this.moneyToCents(this.closePreview()?.expectedCashAmount ?? 0);
  }

  private normalizeCounts(counts: readonly number[]) {
    const normalized = this.denominations.map((_, index) => {
      const raw = counts[index];
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        return 0;
      }

      if (raw < 0) {
        return 0;
      }

      return Math.floor(raw);
    });

    const current = this.countControls.getRawValue();
    const requiresPatch = normalized.some((value, index) => value !== current[index]);
    if (requiresPatch) {
      this.countControls.patchValue(normalized, { emitEvent: false });
    }

    return normalized;
  }

  private normalizePreview(preview: ShiftClosePreviewDto): ShiftClosePreviewDto {
    return {
      ...preview,
      countedCashAmount: preview.countedCashAmount ?? null,
      difference: preview.difference ?? null,
      breakdown: preview.breakdown ?? {
        cashAmount: preview.salesCashTotal,
        cardAmount: 0,
        transferAmount: 0,
        totalSalesCount: 0,
      },
    };
  }

  private moneyToCents(value: number) {
    return Math.round(value * 100);
  }

  private centsToMoney(cents: number) {
    return cents / 100;
  }

  private isVoidForbiddenError(error: unknown) {
    const status = this.getHttpStatus(error);
    if (status === 403) {
      return true;
    }

    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    const code =
      typeof error.error === 'object' && error.error
        ? String((error.error as Record<string, unknown>)['code'] ?? '')
        : '';
    return code === 'FORBIDDEN_VOID';
  }

  private getHttpStatus(error: unknown): number {
    if (error instanceof HttpErrorResponse) {
      return error.status;
    }

    if (typeof error === 'object' && error && 'error' in error) {
      const nestedStatus = this.getHttpStatus((error as { error: unknown }).error);
      if (nestedStatus !== -1) {
        return nestedStatus;
      }
    }

    if (typeof error === 'object' && error && 'status' in error) {
      const status = Number((error as { status: unknown }).status);
      return Number.isFinite(status) ? status : -1;
    }

    return -1;
  }

  private extractErrorPayload(error: unknown): unknown {
    if (error instanceof HttpErrorResponse) {
      return error.error;
    }

    if (typeof error === 'object' && error && 'error' in error) {
      return this.extractErrorPayload((error as { error: unknown }).error);
    }

    return null;
  }

  private addToCart(product: ProductDto, customization: ProductCustomizationResult) {
    this.cartItems.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        basePrice: product.basePrice,
        quantity: 1,
        selections: customization.selections,
        extras: customization.extras,
      },
    ]);
    this.cartExpanded.set(true);
    this.scheduleAutoCollapse();
  }

  private scheduleAutoCollapse() {
    this.clearAutoCollapseTimer();
    this.autoCollapseTimer = setTimeout(() => {
      this.cartExpanded.set(false);
      this.autoCollapseTimer = null;
    }, 3000);
  }

  private clearAutoCollapseTimer() {
    if (!this.autoCollapseTimer) {
      return;
    }

    clearTimeout(this.autoCollapseTimer);
    this.autoCollapseTimer = null;
  }

  private async handleSaleError(error: unknown) {
    console.log('[handleSaleError] Entered with error:', error);
    const status = this.getHttpStatus(error);
    const payload = this.extractErrorPayload(error);

    if (status === 409 && this.isNoOpenShiftError(payload)) {
      this.errorMessage.set('No hay turno abierto. Debes abrir turno para continuar.');
      this.inProgressClientSaleId.set(null);
      await this.loadCurrentShift();
      this.showOpenShiftModal.set(true);
      return;
    }

    if (status === 409 && this.isItemUnavailableError(payload)) {
      console.log('[handleSaleError] Entered item unavailable branch');
      console.log('[handleSaleError] status:', status);
      console.log('[handleSaleError] payload:', payload);
      const unavailable = this.getUnavailableItemData(payload);
      console.log('[handleSaleError] unavailable data:', unavailable);
      this.unavailableItemName.set(unavailable.itemName);
      this.errorMessage.set('No disponible. Actualiza catálogo e intenta de nuevo.');
      this.canRefreshCatalogAfterUnavailable.set(true);
      this.showPayment.set(false);
      this.inProgressClientSaleId.set(null);
      return;
    }

    if (status === 409 && this.isDuplicateSaleError(payload)) {
      this.errorMessage.set('Esta venta ya fue registrada.');
      this.inProgressClientSaleId.set(null);
      return;
    }

    if (status === 409) {
      console.log('[handleSaleError] Entered generic 409 branch');
      const unavailable = this.getUnavailableItemData(payload);
      console.log('[handleSaleError] unavailable data from generic:', unavailable);
      this.unavailableItemName.set(unavailable.itemName);
      this.errorMessage.set('No disponible. Actualiza catálogo e intenta de nuevo.');
      this.canRefreshCatalogAfterUnavailable.set(true);
      this.showPayment.set(false);
      this.inProgressClientSaleId.set(null);
      return;
    }

    if (status === 0) {
      this.errorMessage.set(
        'Error de red. Puedes reintentar y se reutilizará el mismo clientSaleId para evitar duplicados.',
      );
      return;
    }

    if (status === 400) {
      this.errorMessage.set('Solicitud inválida. Revisa los datos del cobro.');
      return;
    }

    this.errorMessage.set('No fue posible registrar la venta.');
  }

  private isNoOpenShiftError(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    const code = String(data['code'] ?? '').toLowerCase();
    const title = String(data['title'] ?? '').toLowerCase();
    const detail = String(data['detail'] ?? '').toLowerCase();

    return code.includes('open_shift') || title.includes('turno') || detail.includes('open shift');
  }

  async refreshCatalogAfterUnavailable() {
    this.snapshotService.invalidate(this.storeContext.getActiveStoreId() ?? undefined);
    await this.loadSnapshot(true);
  }

  private isItemUnavailableError(payload: unknown) {
    const unavailableData = this.getUnavailableItemData(payload);
    if (unavailableData.isItemUnavailable) {
      return true;
    }

    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    const code = this.getStringValue(data, null, 'code')?.toLowerCase() ?? '';
    const title = this.getStringValue(data, null, 'title')?.toLowerCase() ?? '';
    const detail = this.getStringValue(data, null, 'detail')?.toLowerCase() ?? '';

    return (
      code.includes('item_unavailable') ||
      title.includes('itemunavailable') ||
      detail.includes('no disponible')
    );
  }

  private isDuplicateSaleError(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    const code = this.getStringValue(data, null, 'code')?.toLowerCase() ?? '';
    const title = this.getStringValue(data, null, 'title')?.toLowerCase() ?? '';
    const detail = this.getStringValue(data, null, 'detail')?.toLowerCase() ?? '';

    return (
      code.includes('duplicate') ||
      code.includes('already_exists') ||
      title.includes('duplicate') ||
      detail.includes('duplicad') ||
      detail.includes('already')
    );
  }

  private getUnavailableItemData(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return {
        isItemUnavailable: false,
        itemName: null,
      };
    }

    const data = payload as Record<string, unknown>;
    const extensions =
      typeof data['extensions'] === 'object' && data['extensions']
        ? (data['extensions'] as Record<string, unknown>)
        : null;

    const itemType = this.getStringValue(data, extensions, 'itemType');
    const itemId = this.getStringValue(data, extensions, 'itemId');
    const itemName = this.resolveUnavailableItemName(data, extensions, itemId);

    return {
      isItemUnavailable: Boolean(itemType && itemId),
      itemName,
    };
  }

  private resolveUnavailableItemName(
    data: Record<string, unknown>,
    extensions: Record<string, unknown> | null,
    itemId: string | null,
  ) {
    const payloadItemName = this.getStringValue(data, extensions, 'itemName');
    if (payloadItemName) {
      return payloadItemName;
    }

    if (!itemId) {
      return null;
    }

    const fallbackFromCart = this.cartItems().find(
      (item) => item.productId === itemId,
    )?.productName;
    return fallbackFromCart?.trim() ? fallbackFromCart.trim() : null;
  }

  private getStringValue(
    data: Record<string, unknown>,
    extensions: Record<string, unknown> | null,
    key: string,
  ) {
    const candidates = [data[key], extensions?.[key]];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  formatDateTime(value: string) {
    return this.timezone.formatDateTime(value);
  }
}
