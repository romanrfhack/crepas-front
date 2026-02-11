import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExtraDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-extras-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Extras</h2>
      <form class="row" (submit)="onSubmit($event)">
        <input [formControl]="nameControl" placeholder="Nombre" />
        <input [formControl]="priceControl" type="number" min="0" step="0.01" />
        <label><input [formControl]="isActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">{{ editingId() ? 'Guardar' : 'Crear' }}</button>
      </form>
      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }
      <ul class="list">
        @for (item of extras(); track item.id) {
          <li>
            <span>{{ item.name }} - $ {{ item.price }} - {{ item.isActive ? 'Activo' : 'Inactivo' }}</span>
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
    input { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    button { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .actions { display: flex; gap: 0.5rem; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtrasPage {
  private readonly api = inject(PosCatalogApiService);

  readonly extras = signal<ExtraDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);

  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly priceControl = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.nameControl.invalid || this.priceControl.invalid) {
      return;
    }

    try {
      const payload = {
        name: this.nameControl.value.trim(),
        price: this.priceControl.value,
        isActive: this.isActiveControl.value,
      };
      const id = this.editingId();
      if (id) {
        await this.api.updateExtra(id, payload);
      } else {
        await this.api.createExtra(payload);
      }
      this.editingId.set(null);
      this.nameControl.setValue('');
      this.priceControl.setValue(0);
      this.isActiveControl.setValue(true);
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible guardar el extra.');
    }
  }

  onEdit(item: ExtraDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.priceControl.setValue(item.price);
    this.isActiveControl.setValue(item.isActive);
  }

  async onDeactivate(item: ExtraDto) {
    try {
      await this.api.deactivateExtra(item.id);
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible desactivar el extra.');
    }
  }

  private async load() {
    this.errorMessage.set('');
    try {
      this.extras.set(await this.api.getExtras(true));
    } catch {
      this.errorMessage.set('No fue posible cargar extras.');
    }
  }
}
