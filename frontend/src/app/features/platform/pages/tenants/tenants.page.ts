import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformTenantDto, PlatformVerticalDto } from '../../models/platform.models';
import { PlatformTenantContextService } from '../../services/platform-tenant-context.service';
import { PlatformTenantsApiService } from '../../services/platform-tenants-api.service';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';

interface ProblemLike {
  detail?: string;
  title?: string;
}

@Component({
  selector: 'app-platform-tenants-page',
  imports: [ReactiveFormsModule],
  template: `
    <section data-testid="platform-tenants-page">
      <h2>Plataforma · Tenants</h2>
      <p>Al crear un tenant se genera automáticamente la tienda Matriz.</p>
      <label>
        Buscar
        <input [formControl]="searchControl" />
      </label>
      <button type="button" data-testid="tenant-create-open" (click)="startCreate()">Crear tenant</button>

      @if (showForm()) {
        <form (submit)="save($event)">
          <label>
            Name
            <input [formControl]="nameControl" data-testid="tenant-form-name" />
          </label>
          <label>
            Slug
            <input [formControl]="slugControl" data-testid="tenant-form-slug" />
          </label>
          <label>
            Vertical
            <select [formControl]="verticalControl" data-testid="tenant-form-vertical">
              <option value="" disabled>Selecciona</option>
              @for (vertical of verticals(); track vertical.id) {
                <option [value]="vertical.id">{{ vertical.name }}</option>
              }
            </select>
          </label>
          <label>
            Is Active
            <input type="checkbox" [formControl]="isActiveControl" data-testid="tenant-form-is-active" />
          </label>
          <button type="submit" data-testid="tenant-save">Guardar</button>
        </form>
      }

      @if (error()) {
        <p role="alert" data-testid="platform-tenants-error">{{ error() }}</p>
      }
      @if (success()) {
        <p data-testid="platform-tenants-success">{{ success() }}</p>
      }

      <table>
        <tbody>
          @for (item of filteredTenants(); track item.id) {
            <tr [attr.data-testid]="'tenant-row-' + item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.slug }}</td>
              <td>{{ verticalName(item.verticalId) }}</td>
              <td>{{ item.isActive ? 'Sí' : 'No' }}</td>
              <td>{{ item.defaultStoreId ?? '—' }}</td>
              <td>
                <button type="button" [attr.data-testid]="'tenant-edit-' + item.id" (click)="edit(item)">Editar</button>
                <button type="button" [attr.data-testid]="'tenant-delete-' + item.id" (click)="remove(item)">Eliminar</button>
                <button type="button" [attr.data-testid]="'tenant-set-context-' + item.id" (click)="setTenantContext(item.id)">Usar este tenant</button>
                @if (selectedTenantId() === item.id) {
                  <span [attr.data-testid]="'tenant-context-active-' + item.id">Activo</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantsPage {
  private readonly tenantsApi = inject(PlatformTenantsApiService);
  private readonly verticalsApi = inject(PlatformVerticalsApiService);
  private readonly tenantContext = inject(PlatformTenantContextService);

  readonly tenants = signal<PlatformTenantDto[]>([]);
  readonly verticals = signal<PlatformVerticalDto[]>([]);
  readonly selectedTenantId = signal(this.tenantContext.getSelectedTenantId());
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal<string | null>(null);
  readonly showForm = computed(() => this.editingId() !== null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly slugControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly verticalControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly isActiveControl = new FormControl({ value: true, disabled: true }, { nonNullable: true });

  readonly filteredTenants = computed(() => {
    const term = this.searchControl.value.trim().toLowerCase();
    if (!term) {
      return this.tenants();
    }

    return this.tenants().filter(
      (item) => item.name.toLowerCase().includes(term) || item.slug.toLowerCase().includes(term),
    );
  });

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      const [tenants, verticals] = await Promise.all([
        this.tenantsApi.listTenants(),
        this.verticalsApi.listVerticals(),
      ]);
      this.tenants.set(tenants);
      this.verticals.set(verticals);
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible cargar tenants.'));
    }
  }

  verticalName(verticalId: string) {
    return this.verticals().find((item) => item.id === verticalId)?.name ?? verticalId;
  }

  startCreate() {
    this.success.set('');
    this.editingId.set('new');
    this.nameControl.setValue('');
    this.slugControl.setValue('');
    this.verticalControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: PlatformTenantDto) {
    this.success.set('');
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.slugControl.setValue(item.slug);
    this.verticalControl.setValue(item.verticalId);
    this.isActiveControl.setValue(item.isActive);
  }

  async save(event: Event) {
    event.preventDefault();
    this.error.set('');
    this.success.set('');

    if (this.nameControl.invalid || this.slugControl.invalid || this.verticalControl.invalid || !this.editingId()) {
      return;
    }

    try {
      if (this.editingId() === 'new') {
        await this.tenantsApi.createTenant({
          verticalId: this.verticalControl.value,
          name: this.nameControl.value,
          slug: this.slugControl.value,
        });
      } else {
        await this.tenantsApi.updateTenant(this.editingId()!, {
          verticalId: this.verticalControl.value,
          name: this.nameControl.value,
          slug: this.slugControl.value,
        });
      }
      this.success.set('Tenant guardado correctamente.');
      this.editingId.set(null);
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible guardar tenant.'));
    }
  }

  async remove(item: PlatformTenantDto) {
    this.error.set('');
    this.success.set('');
    if (!window.confirm(`¿Eliminar tenant ${item.name}?`)) {
      return;
    }

    try {
      await this.tenantsApi.deleteTenant(item.id);
      if (this.selectedTenantId() === item.id) {
        this.tenantContext.setSelectedTenantId(null);
        this.selectedTenantId.set(null);
        this.success.set('Tenant eliminado y contexto limpiado.');
      } else {
        this.success.set('Tenant eliminado correctamente.');
      }
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible eliminar tenant.'));
    }
  }

  setTenantContext(tenantId: string) {
    this.tenantContext.setSelectedTenantId(tenantId);
    this.selectedTenantId.set(tenantId);
    this.success.set('Contexto de tenant actualizado.');
  }

  private mapError(error: unknown, fallback: string) {
    const payload = error as { error?: ProblemLike };
    return payload?.error?.detail ?? payload?.error?.title ?? fallback;
  }
}
