import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformVerticalDto } from '../../models/platform.models';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';

interface ProblemLike {
  detail?: string;
  title?: string;
}

@Component({
  selector: 'app-platform-verticals-page',
  imports: [ReactiveFormsModule],
  template: `
    <section data-testid="platform-verticals-page">
      <h2>Plataforma · Verticals</h2>
      <button type="button" data-testid="vertical-create-open" (click)="startCreate()">Crear vertical</button>

      @if (showForm()) {
        <form (submit)="save($event)">
          <label>
            Name
            <input [formControl]="nameControl" data-testid="vertical-form-name" />
          </label>
          <label>
            Description
            <textarea [formControl]="descriptionControl" data-testid="vertical-form-description"></textarea>
          </label>
          <label>
            Is Active
            <input type="checkbox" [formControl]="isActiveControl" data-testid="vertical-form-is-active" />
          </label>
          <button type="submit" data-testid="vertical-save">Guardar</button>
        </form>
      }

      @if (error()) {
        <p role="alert" data-testid="platform-verticals-error">{{ error() }}</p>
      }
      @if (success()) {
        <p data-testid="platform-verticals-success">{{ success() }}</p>
      }

      <table>
        <tbody>
          @for (item of verticals(); track item.id) {
            <tr [attr.data-testid]="'vertical-row-' + item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.isActive ? 'Sí' : 'No' }}</td>
              <td>{{ item.description ?? '—' }}</td>
              <td>{{ item.updatedAtUtc }}</td>
              <td>
                <button type="button" [attr.data-testid]="'vertical-edit-' + item.id" (click)="edit(item)">Editar</button>
                <button type="button" [attr.data-testid]="'vertical-delete-' + item.id" (click)="remove(item)">Eliminar</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerticalsPage {
  private readonly api = inject(PlatformVerticalsApiService);

  readonly verticals = signal<PlatformVerticalDto[]>([]);
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal<string | null>(null);
  readonly showForm = computed(() => this.editingId() !== null);

  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly descriptionControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl({ value: true, disabled: true }, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      this.verticals.set(await this.api.listVerticals());
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible cargar verticales.'));
    }
  }

  startCreate() {
    this.success.set('');
    this.editingId.set('new');
    this.nameControl.setValue('');
    this.descriptionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: PlatformVerticalDto) {
    this.success.set('');
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.descriptionControl.setValue(item.description ?? '');
    this.isActiveControl.setValue(item.isActive);
  }

  async save(event: Event) {
    event.preventDefault();
    this.error.set('');
    this.success.set('');
    if (this.nameControl.invalid || !this.editingId()) {
      return;
    }

    const payload = { name: this.nameControl.value, description: this.descriptionControl.value || null };

    try {
      if (this.editingId() === 'new') {
        await this.api.createVertical(payload);
      } else {
        await this.api.updateVertical(this.editingId()!, payload);
      }
      this.success.set('Vertical guardada correctamente.');
      this.editingId.set(null);
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible guardar vertical.'));
    }
  }

  async remove(item: PlatformVerticalDto) {
    this.error.set('');
    this.success.set('');
    if (!window.confirm(`¿Eliminar vertical ${item.name}?`)) {
      return;
    }

    try {
      await this.api.deleteVertical(item.id);
      this.success.set('Vertical eliminada correctamente.');
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible eliminar vertical.'));
    }
  }

  private mapError(error: unknown, fallback: string) {
    const payload = error as { error?: ProblemLike };
    return payload?.error?.detail ?? payload?.error?.title ?? fallback;
  }
}
