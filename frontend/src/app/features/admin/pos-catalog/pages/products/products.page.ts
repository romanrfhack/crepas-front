import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryDto, ProductDto, SchemaDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-products-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Productos</h2>
      <form class="grid" (submit)="onSubmit($event)">
        <input [formControl]="nameControl" placeholder="Nombre" aria-label="Nombre" />
        <input [formControl]="basePriceControl" type="number" min="0" step="0.01" aria-label="Precio base" />
        <select [formControl]="categoryIdControl" aria-label="Categoría">
          @for (category of categories(); track category.id) {
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
        <select [formControl]="schemaIdControl" aria-label="Schema">
          <option value="">Sin schema</option>
          @for (schema of schemas(); track schema.id) {
            <option [value]="schema.id">{{ schema.name }}</option>
          }
        </select>
        <label><input [formControl]="isActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">{{ editingId() ? 'Guardar' : 'Crear' }}</button>
      </form>
      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }
      <ul class="list">
        @for (item of products(); track item.id) {
          <li>
            <span>{{ item.name }} - $ {{ item.basePrice }} - {{ item.isActive ? 'Activo' : 'Inactivo' }}</span>
            <div class="actions">
              <button type="button" (click)="onEdit(item)">Editar</button>
              <button type="button" (click)="onDeactivate(item)">Desactivar</button>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 0.75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.5rem; align-items: center; }
    input, select { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    button { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .actions { display: flex; gap: 0.5rem; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  private readonly api = inject(PosCatalogApiService);

  readonly categories = signal<CategoryDto[]>([]);
  readonly schemas = signal<SchemaDto[]>([]);
  readonly products = signal<ProductDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly basePriceControl = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(0)],
  });
  readonly categoryIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly schemaIdControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.bootstrap();
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.nameControl.invalid || this.categoryIdControl.invalid || this.basePriceControl.invalid) {
      return;
    }

    this.errorMessage.set('');
    const payload = {
      externalCode: null,
      name: this.nameControl.value.trim(),
      categoryId: this.categoryIdControl.value,
      subcategoryName: null,
      basePrice: this.basePriceControl.value,
      isActive: this.isActiveControl.value,
      customizationSchemaId: this.schemaIdControl.value || null,
    };

    try {
      const id = this.editingId();
      if (id) {
        await this.api.updateProduct(id, payload);
      } else {
        await this.api.createProduct(payload);
      }
      this.resetForm();
      await this.loadProducts();
    } catch {
      this.errorMessage.set('No fue posible guardar el producto.');
    }
  }

  onEdit(item: ProductDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.basePriceControl.setValue(item.basePrice);
    this.categoryIdControl.setValue(item.categoryId);
    this.schemaIdControl.setValue(item.customizationSchemaId ?? '');
    this.isActiveControl.setValue(item.isActive);
  }

  async onDeactivate(item: ProductDto) {
    this.errorMessage.set('');
    try {
      await this.api.deactivateProduct(item.id);
      await this.loadProducts();
    } catch {
      this.errorMessage.set('No fue posible desactivar el producto.');
    }
  }

  private async bootstrap() {
    try {
      const [categories, schemas] = await Promise.all([this.api.getCategories(true), this.api.getSchemas(true)]);
      this.categories.set(categories);
      this.schemas.set(schemas);
      if (categories.length > 0) {
        this.categoryIdControl.setValue(categories[0].id);
      }
      await this.loadProducts();
    } catch {
      this.errorMessage.set('No fue posible cargar catálogos base.');
    }
  }

  private async loadProducts() {
    this.products.set(await this.api.getProducts(true));
  }

  private resetForm() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.basePriceControl.setValue(0);
    this.schemaIdControl.setValue('');
    this.isActiveControl.setValue(true);
  }
}
