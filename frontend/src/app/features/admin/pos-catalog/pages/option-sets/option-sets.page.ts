import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionItemDto, OptionSetDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-option-sets-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Option sets e items</h2>
      <form class="row" (submit)="onSubmitSet($event)">
        <input [formControl]="setNameControl" placeholder="Nombre option set" aria-label="Option set" />
        <label><input [formControl]="setIsActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">Crear option set</button>
      </form>

      <label>
        Option set seleccionado
        <select [formControl]="selectedSetIdControl">
          @for (item of optionSets(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </label>

      <form class="row" (submit)="onSubmitItem($event)">
        <input [formControl]="itemNameControl" placeholder="Nombre item" aria-label="Item" />
        <input [formControl]="itemSortOrderControl" type="number" min="0" aria-label="Orden" />
        <label><input [formControl]="itemIsActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">{{ editingItemId() ? 'Guardar item' : 'Crear item' }}</button>
      </form>

      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }

      <ul class="list">
        @for (item of optionItems(); track item.id) {
          <li>
            <span>{{ item.name }} (#{{ item.sortOrder }}) - {{ item.isActive ? 'Activo' : 'Inactivo' }}</span>
            <div class="actions">
              <button type="button" (click)="onEditItem(item)">Editar</button>
              <button type="button" (click)="onDeactivateItem(item)">Desactivar</button>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 0.75rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    input, select { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    button { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .actions { display: flex; gap: 0.5rem; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionSetsPage {
  private readonly api = inject(PosCatalogApiService);

  readonly optionSets = signal<OptionSetDto[]>([]);
  readonly optionItems = signal<OptionItemDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingItemId = signal<string | null>(null);

  readonly setNameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly setIsActiveControl = new FormControl(true, { nonNullable: true });
  readonly selectedSetIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly itemNameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly itemSortOrderControl = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });
  readonly itemIsActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    this.selectedSetIdControl.valueChanges.subscribe(() => {
      void this.loadItems();
    });
    void this.loadSets();
  }

  async onSubmitSet(event: Event) {
    event.preventDefault();
    if (this.setNameControl.invalid) {
      return;
    }

    try {
      await this.api.createOptionSet({
        name: this.setNameControl.value.trim(),
        isActive: this.setIsActiveControl.value,
      });
      this.setNameControl.setValue('');
      await this.loadSets();
    } catch {
      this.errorMessage.set('No fue posible guardar el option set.');
    }
  }

  async onSubmitItem(event: Event) {
    event.preventDefault();
    const setId = this.selectedSetIdControl.value;
    if (!setId || this.itemNameControl.invalid || this.itemSortOrderControl.invalid) {
      return;
    }

    try {
      const payload = {
        name: this.itemNameControl.value.trim(),
        sortOrder: this.itemSortOrderControl.value,
        isActive: this.itemIsActiveControl.value,
      };
      const itemId = this.editingItemId();
      if (itemId) {
        await this.api.updateOptionItem(setId, itemId, payload);
      } else {
        await this.api.createOptionItem(setId, payload);
      }
      this.editingItemId.set(null);
      this.itemNameControl.setValue('');
      this.itemSortOrderControl.setValue(0);
      this.itemIsActiveControl.setValue(true);
      await this.loadItems();
    } catch {
      this.errorMessage.set('No fue posible guardar el item.');
    }
  }

  onEditItem(item: OptionItemDto) {
    this.editingItemId.set(item.id);
    this.itemNameControl.setValue(item.name);
    this.itemSortOrderControl.setValue(item.sortOrder);
    this.itemIsActiveControl.setValue(item.isActive);
  }

  async onDeactivateItem(item: OptionItemDto) {
    const setId = this.selectedSetIdControl.value;
    if (!setId) {
      return;
    }

    try {
      await this.api.deactivateOptionItem(setId, item.id);
      await this.loadItems();
    } catch {
      this.errorMessage.set('No fue posible desactivar el item.');
    }
  }

  private async loadSets() {
    this.errorMessage.set('');
    try {
      const sets = await this.api.getOptionSets(true);
      this.optionSets.set(sets);
      if (sets.length > 0) {
        this.selectedSetIdControl.setValue(sets[0].id);
      }
      await this.loadItems();
    } catch {
      this.errorMessage.set('No fue posible cargar option sets.');
    }
  }

  private async loadItems() {
    const setId = this.selectedSetIdControl.value;
    if (!setId) {
      this.optionItems.set([]);
      return;
    }

    this.optionItems.set(await this.api.getOptionItems(setId, true));
  }
}
