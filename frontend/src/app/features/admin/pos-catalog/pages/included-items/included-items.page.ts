import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExtraDto, IncludedItemDto, ProductDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-included-items-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Included items</h2>
      <label>
        Producto
        <select [formControl]="productIdControl">
          @for (item of products(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </label>

      <form class="row" (submit)="onAddRow($event)">
        <select [formControl]="extraIdControl">
          @for (item of extras(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
        <input [formControl]="quantityControl" type="number" min="1" />
        <button type="submit">Agregar/actualizar</button>
      </form>

      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }

      <ul class="list">
        @for (row of rows(); track row.extraId) {
          <li>
            <span>{{ getExtraName(row.extraId) }} x {{ row.quantity }}</span>
            <button type="button" (click)="onRemoveRow(row.extraId)">Quitar</button>
          </li>
        }
      </ul>

      <button type="button" (click)="onSave()" [disabled]="!canSave()">Guardar included items</button>

      <p class="hint">Se reemplaza la lista completa del producto seleccionado.</p>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 0.75rem; }
    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    select, input { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    button { width: fit-content; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
    .hint { margin: 0; color: #475569; font-size: 0.9rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncludedItemsPage {
  private readonly api = inject(PosCatalogApiService);

  readonly products = signal<ProductDto[]>([]);
  readonly extras = signal<ExtraDto[]>([]);
  readonly includedItems = signal<IncludedItemDto[]>([]);
  readonly localRows = signal<Record<string, number>>({});
  readonly errorMessage = signal('');

  readonly productIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly extraIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly quantityControl = new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] });

  readonly rows = computed(() =>
    Object.entries(this.localRows()).map(([extraId, quantity]) => ({ extraId, quantity })),
  );
  readonly canSave = computed(() => this.productIdControl.valid);

  constructor() {
    this.productIdControl.valueChanges.subscribe(() => {
      void this.loadIncludedItems();
    });
    void this.bootstrap();
  }

  async onAddRow(event: Event) {
    event.preventDefault();
    if (this.extraIdControl.invalid || this.quantityControl.invalid) {
      return;
    }

    this.localRows.update((current) => ({
      ...current,
      [this.extraIdControl.value]: this.quantityControl.value,
    }));
  }

  onRemoveRow(extraId: string) {
    this.localRows.update((current) => {
      const updated = { ...current };
      delete updated[extraId];
      return updated;
    });
  }

  async onSave() {
    const productId = this.productIdControl.value;
    if (!productId) {
      return;
    }

    this.errorMessage.set('');
    try {
      const saved = await this.api.replaceIncludedItems(productId, {
        items: this.rows().map((row) => ({ extraId: row.extraId, quantity: row.quantity })),
      });
      this.includedItems.set(saved);
    } catch {
      this.errorMessage.set('No fue posible guardar los included items.');
    }
  }

  getExtraName(extraId: string) {
    return this.extras().find((item) => item.id === extraId)?.name ?? extraId;
  }

  private async bootstrap() {
    try {
      const [products, extras] = await Promise.all([this.api.getProducts(true), this.api.getExtras(true)]);
      this.products.set(products);
      this.extras.set(extras);
      if (products.length > 0) {
        this.productIdControl.setValue(products[0].id);
      }
      if (extras.length > 0) {
        this.extraIdControl.setValue(extras[0].id);
      }
      await this.loadIncludedItems();
    } catch {
      this.errorMessage.set('No fue posible cargar productos/extras.');
    }
  }

  private async loadIncludedItems() {
    const productId = this.productIdControl.value;
    if (!productId) {
      this.includedItems.set([]);
      this.localRows.set({});
      return;
    }

    const items = await this.api.getIncludedItems(productId);
    this.includedItems.set(items);
    this.localRows.set(
      items.reduce<Record<string, number>>((acc, row) => {
        acc[row.extraId] = row.quantity;
        return acc;
      }, {}),
    );
  }
}
