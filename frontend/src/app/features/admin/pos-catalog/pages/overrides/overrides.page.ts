import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionItemDto, ProductDto, SchemaDto, SelectionGroupDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-overrides-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Overrides por producto</h2>
      <label>
        Producto
        <select [formControl]="productIdControl">
          @for (item of products(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </label>

      <label>
        Group key
        <select [formControl]="groupKeyControl">
          @for (group of productGroups(); track group.id) {
            <option [value]="group.key">{{ group.label }} ({{ group.key }})</option>
          }
        </select>
      </label>

      <fieldset>
        <legend>Allowed items</legend>
        @for (item of availableItems(); track item.id) {
          <label class="checkbox-row">
            <input type="checkbox" [checked]="isAllowed(item.id)" (change)="toggleAllowed(item.id, $event)" />
            {{ item.name }}
          </label>
        }
      </fieldset>

      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }

      <button type="button" (click)="onSave()" [disabled]="productIdControl.invalid || groupKeyControl.invalid">
        Guardar override
      </button>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 0.75rem; }
    select { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    fieldset { border: 1px solid #e2e8f0; border-radius: 0.75rem; background: #fff; padding: 0.75rem; display: grid; gap: 0.45rem; }
    .checkbox-row { display: flex; align-items: center; gap: 0.45rem; }
    button { width: fit-content; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverridesPage {
  private readonly api = inject(PosCatalogApiService);

  readonly products = signal<ProductDto[]>([]);
  readonly schemas = signal<SchemaDto[]>([]);
  readonly groupsBySchema = signal<Record<string, SelectionGroupDto[]>>({});
  readonly optionItemsBySet = signal<Record<string, OptionItemDto[]>>({});
  readonly allowed = signal<Record<string, boolean>>({});
  readonly errorMessage = signal('');

  readonly productIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly groupKeyControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly selectedProduct = computed(() =>
    this.products().find((item) => item.id === this.productIdControl.value) ?? null,
  );
  readonly productGroups = computed(() => {
    const schemaId = this.selectedProduct()?.customizationSchemaId;
    return schemaId ? this.groupsBySchema()[schemaId] ?? [] : [];
  });
  readonly availableItems = computed(() => {
    const group = this.productGroups().find((item) => item.key === this.groupKeyControl.value);
    if (!group) {
      return [];
    }

    return this.optionItemsBySet()[group.optionSetId] ?? [];
  });

  constructor() {
    this.productIdControl.valueChanges.subscribe(() => {
      const first = this.productGroups()[0];
      this.groupKeyControl.setValue(first?.key ?? '');
      this.allowed.set({});
    });

    this.groupKeyControl.valueChanges.subscribe(() => {
      this.allowed.set({});
    });

    void this.bootstrap();
  }

  isAllowed(optionItemId: string) {
    return this.allowed()[optionItemId] ?? false;
  }

  toggleAllowed(optionItemId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allowed.update((current) => ({ ...current, [optionItemId]: checked }));
  }

  async onSave() {
    const productId = this.productIdControl.value;
    const groupKey = this.groupKeyControl.value;
    if (!productId || !groupKey) {
      return;
    }

    this.errorMessage.set('');
    try {
      await this.api.upsertOverride(productId, groupKey, {
        allowedOptionItemIds: Object.entries(this.allowed())
          .filter(([, checked]) => checked)
          .map(([id]) => id),
      });
    } catch {
      this.errorMessage.set('No fue posible guardar el override.');
    }
  }

  private async bootstrap() {
    try {
      const [products, schemas] = await Promise.all([this.api.getProducts(true), this.api.getSchemas(true)]);
      this.products.set(products);
      this.schemas.set(schemas);

      for (const schema of schemas) {
        const groups = await this.api.getGroups(schema.id, true);
        this.groupsBySchema.update((current) => ({ ...current, [schema.id]: groups }));
        for (const group of groups) {
          if (this.optionItemsBySet()[group.optionSetId]) {
            continue;
          }
          const items = await this.api.getOptionItems(group.optionSetId, true);
          this.optionItemsBySet.update((current) => ({ ...current, [group.optionSetId]: items }));
        }
      }

      if (products.length > 0) {
        this.productIdControl.setValue(products[0].id);
      }
      const firstGroup = this.productGroups()[0];
      if (firstGroup) {
        this.groupKeyControl.setValue(firstGroup.key);
      }
    } catch {
      this.errorMessage.set('No fue posible cargar los datos para overrides.');
    }
  }
}
