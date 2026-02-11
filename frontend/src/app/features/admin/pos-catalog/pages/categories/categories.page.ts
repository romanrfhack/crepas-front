import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-categories-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Categorías</h2>
      <form class="row" (submit)="onSubmit($event)">
        <input [formControl]="nameControl" type="text" placeholder="Nombre" aria-label="Nombre" />
        <input [formControl]="sortOrderControl" type="number" min="0" aria-label="Orden" />
        <label><input [formControl]="isActiveControl" type="checkbox" /> Activa</label>
        <button type="submit">{{ editingId() ? 'Guardar' : 'Crear' }}</button>
      </form>
      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }
      <ul class="list">
        @for (item of categories(); track item.id) {
          <li>
            <span>{{ item.name }} (#{{ item.sortOrder }}) - {{ item.isActive ? 'Activa' : 'Inactiva' }}</span>
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
    .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .row input[type='text'], .row input[type='number'] { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; }
    button { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.4rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .actions { display: flex; gap: 0.5rem; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage {
  private readonly api = inject(PosCatalogApiService);

  readonly categories = signal<CategoryDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly sortOrderControl = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.nameControl.invalid || this.sortOrderControl.invalid) {
      return;
    }

    this.errorMessage.set('');
    const payload = {
      name: this.nameControl.value.trim(),
      sortOrder: this.sortOrderControl.value,
      isActive: this.isActiveControl.value,
    };

    try {
      const id = this.editingId();
      if (id) {
        await this.api.updateCategory(id, payload);
      } else {
        await this.api.createCategory(payload);
      }
      this.resetForm();
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible guardar la categoría.');
    }
  }

  onEdit(item: CategoryDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.sortOrderControl.setValue(item.sortOrder);
    this.isActiveControl.setValue(item.isActive);
  }

  async onDeactivate(item: CategoryDto) {
    this.errorMessage.set('');
    try {
      await this.api.deactivateCategory(item.id);
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible desactivar la categoría.');
    }
  }

  private async load() {
    this.errorMessage.set('');
    try {
      this.categories.set(await this.api.getCategories(true));
    } catch {
      this.errorMessage.set('No fue posible cargar categorías.');
    }
  }

  private resetForm() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.sortOrderControl.setValue(0);
    this.isActiveControl.setValue(true);
  }
}
