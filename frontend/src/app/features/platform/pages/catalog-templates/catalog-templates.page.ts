import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformCatalogTemplatesApiService } from '../../services/platform-catalog-templates-api.service';
import { CatalogTemplateDto } from '../../models/platform.models';

@Component({
  selector: 'app-platform-catalog-templates-page',
  imports: [ReactiveFormsModule],
  template: `
    <section data-testid="platform-templates-page">
      <h2>Plataforma · Catalog Templates</h2>
      <label for="vertical-filter">Vertical</label>
      <input id="vertical-filter" [formControl]="verticalFilterControl" />
      <button type="button" (click)="loadTemplates()">Filtrar</button>

      <button type="button" data-testid="platform-template-create" (click)="startCreate()">Crear</button>

      @if (isEditing()) {
        <form (submit)="saveTemplate($event)">
          <input [formControl]="verticalIdControl" placeholder="Vertical ID" />
          <input [formControl]="nameControl" placeholder="Nombre" />
          <input [formControl]="versionControl" placeholder="Versión" />
          <label><input type="checkbox" [formControl]="isActiveControl" />Activo</label>
          <button type="submit" data-testid="platform-template-save">Guardar</button>
        </form>
      }

      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      <table>
        <tbody>
          @for (item of templates(); track item.id; let i = $index) {
            <tr [attr.data-testid]="'platform-template-row-' + i">
              <td>{{ item.name }}</td>
              <td>{{ item.verticalId }}</td>
              <td>{{ item.version ?? '—' }}</td>
              <td>{{ item.isActive ? 'Sí' : 'No' }}</td>
              <td>{{ item.updatedAtUtc }}</td>
              <td><button type="button" (click)="edit(item)">Editar</button></td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogTemplatesPage {
  private readonly api = inject(PlatformCatalogTemplatesApiService);

  readonly templates = signal<CatalogTemplateDto[]>([]);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null || this.nameControl.value.length > 0);

  readonly verticalFilterControl = new FormControl('', { nonNullable: true });
  readonly verticalIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly versionControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.loadTemplates();
  }

  async loadTemplates() {
    this.error.set('');
    try {
      this.templates.set(await this.api.listTemplates(this.verticalFilterControl.value || undefined));
    } catch {
      this.error.set('No fue posible cargar templates.');
    }
  }

  startCreate() {
    this.editingId.set('');
    this.verticalIdControl.setValue('');
    this.nameControl.setValue('');
    this.versionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: CatalogTemplateDto) {
    this.editingId.set(item.id);
    this.verticalIdControl.setValue(item.verticalId);
    this.nameControl.setValue(item.name);
    this.versionControl.setValue(item.version ?? '');
    this.isActiveControl.setValue(item.isActive);
  }

  async saveTemplate(event: Event) {
    event.preventDefault();
    if (this.verticalIdControl.invalid || this.nameControl.invalid) {
      return;
    }

    const payload = {
      verticalId: this.verticalIdControl.value,
      name: this.nameControl.value,
      version: this.versionControl.value || null,
      isActive: this.isActiveControl.value,
    };

    try {
      if (this.editingId()) {
        await this.api.updateTemplate(this.editingId()!, payload);
      } else {
        await this.api.createTemplate(payload);
      }
      this.editingId.set(null);
      this.nameControl.setValue('');
      await this.loadTemplates();
    } catch {
      this.error.set('No fue posible guardar template.');
    }
  }
}
