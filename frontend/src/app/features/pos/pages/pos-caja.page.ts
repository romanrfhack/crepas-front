import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  CatalogSnapshotDto,
  CreateSaleRequestDto,
  PosShiftDto,
  ProductDto,
  SaleResponseDto,
} from '../models/pos.models';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';

@Component({
  selector: 'app-pos-caja-page',
  imports: [
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

  readonly correlationId = signal(crypto.randomUUID());
  readonly inProgressClientSaleId = signal<string | null>(null);
  readonly requireOpenShift = environment.posRequireOpenShift;

  readonly categories = computed(() => this.snapshot()?.categories.filter((item) => item.isActive) ?? []);
  readonly hasOpenShift = computed(() => this.currentShift()?.closedAtUtc == null && this.currentShift() !== null);

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
        const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.unitPrice * extra.quantity, 0);
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
  readonly customizationExtras = computed(() => this.snapshot()?.extras.filter((extra) => extra.isActive) ?? []);

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
      const shift = await this.salesApi.getCurrentShift();
      this.currentShift.set(shift);
    } catch {
      this.errorMessage.set('No se pudo consultar el estado del turno.');
    }
  }

  async openShift() {
    try {
      const shift = await this.salesApi.openShift({
        openingCashAmount: 0,
        notes: 'Apertura rápida desde Caja POS',
        clientOperationId: crypto.randomUUID(),
      });
      this.currentShift.set(shift);
    } catch {
      this.errorMessage.set('No se pudo abrir el turno.');
    }
  }

  async closeShift() {
    try {
      const shift = await this.salesApi.closeShift({
        closingCashAmount: this.estimatedTotal(),
        notes: 'Cierre rápido desde Caja POS',
        clientOperationId: crypto.randomUUID(),
      });
      this.currentShift.set(shift);
    } catch {
      this.errorMessage.set('No se pudo cerrar el turno.');
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

    if (this.requireOpenShift && !this.hasOpenShift()) {
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
      this.handleSaleError(error);
    } finally {
      this.loading.set(false);
    }
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

  private handleSaleError(error: unknown) {
    const httpError = error as HttpErrorResponse;
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

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
