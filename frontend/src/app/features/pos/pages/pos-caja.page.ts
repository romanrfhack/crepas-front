import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  ShiftClosePreviewDto,
  ProductDto,
  SaleResponseDto,
} from '../models/pos.models';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { PosShiftApiService } from '../services/pos-shift-api.service';

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
export class PosCajaPage {
  private readonly snapshotService = inject(PosCatalogSnapshotService);
  private readonly salesApi = inject(PosSalesApiService);
  private readonly shiftApi = inject(PosShiftApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly shortDateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  readonly snapshot = signal<CatalogSnapshotDto | null>(null);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly cartItems = signal<CartItem[]>([]);
  readonly activeCustomizationProduct = signal<ProductDto | null>(null);
  readonly showPayment = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly saleSuccess = signal<SaleResponseDto | null>(null);
  readonly currentShift = signal<PosShiftDto | null>(null);
  readonly showOpenShiftModal = signal(false);
  readonly showCloseShiftModal = signal(false);
  readonly closePreview = signal<ShiftClosePreviewDto | null>(null);
  readonly closeResult = signal<CloseShiftResultDto | null>(null);

  readonly correlationId = signal(crypto.randomUUID());
  readonly inProgressClientSaleId = signal<string | null>(null);
  readonly requireOpenShift = environment.posRequireOpenShift;

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
        this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      ),
    ),
  });

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
      openedAt: this.formatDateTime(shift.openedAtUtc),
      openingCashAmount: shift.openingCashAmount,
    };
  });

  readonly closeExpectedAmount = computed(() => this.closePreview()?.expectedCashAmount ?? 0);

  readonly countedTotal = computed(() =>
    this.round2(
      this.denominations.reduce((total, denomination, index) => {
        const quantity = this.countControls.at(index)?.value ?? 0;
        return total + denomination * quantity;
      }, 0),
    ),
  );

  readonly closeDifference = computed(() => this.round2(this.countedTotal() - this.closeExpectedAmount()));
  readonly requiresDifferenceReason = computed(() => this.closeDifference() !== 0);
  readonly largeDifferenceWarning = computed(() => Math.abs(this.closeDifference()) >= 200);

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

  readonly customizationOptionItems = computed(() => this.snapshot()?.optionItems ?? []);
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
    void this.loadSnapshot();
    void this.loadCurrentShift();
    console.debug('[POS Caja] correlationId', this.correlationId());
  }

  async loadSnapshot(forceRefresh = false) {
    this.errorMessage.set(null);
    try {
      const data = await this.snapshotService.getSnapshot(forceRefresh);
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

    try {
      const preview = await this.shiftApi.getClosePreview();
      this.closePreview.set(preview);
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

  async submitCloseShift() {
    const shift = this.currentShift();
    if (!shift || this.loading()) {
      return;
    }

    if (this.requiresDifferenceReason() && !this.closeShiftForm.controls.reason.value.trim()) {
      this.errorMessage.set('Debes capturar un motivo cuando exista diferencia en cierre de caja.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { reason, evidence } = this.closeShiftForm.getRawValue();

    try {
      const closeNotes = [reason, evidence].filter((value) => !!value?.trim()).join(' | ');
      const result = await this.shiftApi.closeShift(this.buildCountedDenominations(), closeNotes || null);
      this.closeResult.set(result);
      this.currentShift.set({
        ...shift,
        closedAtUtc: result.closedAtUtc,
        closingCashAmount: result.countedCashAmount,
        closeNotes: result.closeNotes,
      });
      this.showCloseShiftModal.set(false);
    } catch {
      this.errorMessage.set('No se pudo cerrar el turno.');
    } finally {
      this.loading.set(false);
    }
  }

  onProductSelected(product: ProductDto) {
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
      payment: {
        method: event.method,
        amount: this.estimatedTotal(),
        reference: event.reference,
      },
    };

    try {
      const response = await this.salesApi.createSale(payload, this.correlationId());
      this.saleSuccess.set(response);
      this.cartItems.set([]);
      this.showPayment.set(false);
      this.inProgressClientSaleId.set(null);
    } catch (error) {
      await this.handleSaleError(error);
    } finally {
      this.loading.set(false);
    }
  }

  private buildCountedDenominations(): CountedDenominationDto[] {
    return this.denominations
      .map((denominationValue, index) => ({
        denominationValue,
        count: this.countControls.at(index)?.value ?? 0,
      }))
      .filter((line) => line.count > 0);
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
  }

  private async handleSaleError(error: unknown) {
    const httpError = error as HttpErrorResponse;
    if (httpError.status === 409 && this.isNoOpenShiftError(httpError.error)) {
      this.errorMessage.set('No hay turno abierto. Debes abrir turno para continuar.');
      this.inProgressClientSaleId.set(null);
      await this.loadCurrentShift();
      this.showOpenShiftModal.set(true);
      return;
    }

    if (httpError.status === 409) {
      this.errorMessage.set('Esta venta ya fue registrada.');
      this.inProgressClientSaleId.set(null);
      return;
    }

    if (httpError.status === 0) {
      this.errorMessage.set(
        'Error de red. Puedes reintentar y se reutilizará el mismo clientSaleId para evitar duplicados.',
      );
      return;
    }

    if (httpError.status === 400) {
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

  private formatDateTime(value: string) {
    return this.shortDateTimeFormatter.format(new Date(value));
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
