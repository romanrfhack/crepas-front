import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminRolesService } from '../../services/admin-roles.service';
import { RoleDto } from '../../models/admin.models';

@Component({
  selector: 'app-roles-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Administración de roles</h1>
        <p>Crea o elimina roles del sistema.</p>
      </header>

      <form class="create-role" (submit)="onCreateRole($event)">
        <label for="role-name">Nuevo rol</label>
        <input id="role-name" [formControl]="roleNameControl" placeholder="Ej: Supervisor" />
        <button type="submit" [disabled]="roleNameControl.invalid || loading()">Crear rol</button>
      </form>

      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }

      @if (loading()) {
        <p>Cargando roles...</p>
      } @else {
        <ul class="roles-list" aria-label="Listado de roles">
          @for (role of roles(); track role.id) {
            <li>
              <span>{{ role.name }}</span>
              <button type="button" (click)="onDeleteRole(role)">Eliminar</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .admin-page {
      width: min(760px, 100%);
      display: grid;
      gap: 1rem;
    }
    .page-header h1,
    .page-header p {
      margin: 0;
    }
    .page-header p {
      color: #475569;
      margin-top: 0.25rem;
    }
    .create-role {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.5rem;
      align-items: end;
    }
    .create-role label {
      grid-column: 1 / -1;
      font-weight: 600;
    }
    .create-role input {
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      padding: 0.5rem;
      font: inherit;
    }
    .create-role button,
    .roles-list button {
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      padding: 0.5rem 0.8rem;
      background: #fff;
      cursor: pointer;
    }
    .roles-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    .roles-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.75rem;
      background: #fff;
    }
    .inline-error {
      margin: 0;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #9f1239;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesAdminPage {
  private readonly adminRolesService = inject(AdminRolesService);

  readonly roleNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  readonly roles = signal<RoleDto[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  constructor() {
    void this.loadRoles();
  }

  async onCreateRole(event: Event) {
    event.preventDefault();
    if (this.roleNameControl.invalid) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const createdRole = await this.adminRolesService.createRole(
        this.roleNameControl.value.trim(),
      );
      this.roles.update((current) => [...current, createdRole]);
      this.roleNameControl.setValue('');
    } catch {
      this.errorMessage.set('No fue posible crear el rol.');
    } finally {
      this.loading.set(false);
    }
  }

  async onDeleteRole(role: RoleDto) {
    this.errorMessage.set('');
    try {
      await this.adminRolesService.deleteRole(role.id);
      this.roles.update((current) => current.filter((currentRole) => currentRole.id !== role.id));
    } catch {
      this.errorMessage.set('No fue posible eliminar el rol.');
    }
  }

  private async loadRoles() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const roles = await this.adminRolesService.getRoles();
      this.roles.set(roles ?? []);
    } catch {
      this.errorMessage.set('No fue posible cargar los roles.');
    } finally {
      this.loading.set(false);
    }
  }
}
