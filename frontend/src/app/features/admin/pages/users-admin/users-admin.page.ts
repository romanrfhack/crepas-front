import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { UserSummary } from '../../models/admin.models';

type AdminScope = 'global' | 'tenant' | 'store' | 'none';

@Component({
  selector: 'app-users-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="users-admin" data-testid="admin-users-page">
      <header class="header">
        <h1>Administración de usuarios</h1>
        <p class="subtitle">Gestiona roles y estado respetando el alcance del usuario actual.</p>
        <span class="scope-badge" data-testid="admin-users-scope-badge">{{
          scopeBadgeLabel()
        }}</span>
      </header>

      <form class="filters" (submit)="onSearch($event)">
        <input
          type="search"
          [formControl]="searchControl"
          placeholder="Buscar por nombre o email"
          data-testid="admin-users-filter-search"
        />

        @if (canFilterTenant()) {
          <input
            type="text"
            [formControl]="tenantFilterControl"
            placeholder="tenantId"
            data-testid="admin-users-filter-tenant"
          />
        }

        @if (canFilterStore()) {
          <input
            type="text"
            [formControl]="storeFilterControl"
            placeholder="storeId"
            data-testid="admin-users-filter-store"
          />
        }

        <button type="submit">Buscar</button>
        <button
          type="button"
          data-testid="admin-users-create-open"
          [disabled]="scope() === 'none'"
          (click)="openCreateFormFromContext()"
        >
          Nuevo usuario
        </button>
      </form>

      @if (createFormVisible()) {
        <section class="create-panel" data-testid="admin-users-create-context-badge">
          <p>{{ createContextMessage() }}</p>
          <p data-testid="admin-users-create-context-tenant">
            Tenant: {{ createTenantControl.value || 'N/A' }}
          </p>
          <p data-testid="admin-users-create-context-store">
            Store: {{ createStoreControl.value || 'N/A' }}
          </p>

          <form class="inline-form" data-testid="admin-user-form" (submit)="onSubmitCreate($event)">
            <label>
              Rol sugerido
              <select [formControl]="createRoleControl" data-testid="admin-user-form-role">
                <option value="">Selecciona un rol</option>
                @for (role of assignableRoles(); track role) {
                  <option [value]="role">{{ role }}</option>
                }
              </select>
            </label>
            <small data-testid="admin-user-form-role-suggestion">
              {{
                createSuggestedRole()
                  ? 'Sugerido por contexto: ' + createSuggestedRole()
                  : 'Sin rol sugerido por contexto.'
              }}
            </small>

            <label>
              Tenant
              <input
                type="text"
                [formControl]="createTenantControl"
                data-testid="admin-user-form-tenant"
              />
            </label>

            <label>
              Store
              <input
                type="text"
                [formControl]="createStoreControl"
                data-testid="admin-user-form-store"
              />
            </label>

            @if (roleRequiresStore(createRoleControl.value)) {
              <small data-testid="admin-user-form-store-required"
                >El rol AdminStore requiere sucursal.</small
              >
            }

            @if (!createUserAvailable) {
              <small data-testid="admin-user-form-create-unavailable">
                La creación de usuarios no está disponible porque no existe endpoint backend de
                alta de usuarios en /api/v1/admin/users.
              </small>
            }

            <button
              type="submit"
              data-testid="admin-user-form-submit"
              [disabled]="loading() || !createUserAvailable"
            >
              Crear usuario
            </button>
          </form>
        </section>
      }

      @if (successMessage()) {
        <div class="success" data-testid="admin-user-form-success">{{ successMessage() }}</div>
      }
      @if (errorMessage()) {
        <div class="error" data-testid="admin-user-form-error">{{ errorMessage() }}</div>
      }

      @if (loading()) {
        <p>Cargando usuarios...</p>
      } @else if (users().length === 0) {
        <p>Sin resultados para los filtros actuales.</p>
      } @else {
        <ul class="user-list">
          @for (user of users(); track user.id) {
            <li class="user-row" [attr.data-testid]="'admin-users-row-' + user.id">
              <div>
                <p>{{ displayName(user) }}</p>
                <p>{{ user.email }}</p>
                <p>{{ primaryRole(user) }}</p>
                <p [attr.data-testid]="'admin-users-role-' + user.id">Rol: {{ primaryRole(user) }}</p>
                <p>Tenant: {{ user.tenantId ?? 'N/A' }}</p>
                <p [attr.data-testid]="'admin-users-store-' + user.id">
                  Store: {{ user.storeId ?? 'N/A' }}
                </p>
                <p>Estado: {{ isLocked(user) ? 'Bloqueado' : 'Activo' }}</p>
              </div>

              <form
                class="inline-form"
                data-testid="admin-user-form"
                (submit)="onSubmitRoleUpdate($event, user)"
              >
                <label>
                  Rol
                  <select
                    [formControl]="roleDraftControl(user.id)"
                    [attr.data-testid]="'admin-user-form-role'"
                  >
                    @for (role of assignableRoles(); track role) {
                      <option [value]="role">{{ role }}</option>
                    }
                  </select>
                </label>

                <label>
                  Tenant
                  <input
                    type="text"
                    [value]="user.tenantId ?? ''"
                    disabled
                    data-testid="admin-user-form-tenant"
                  />
                </label>

                <label>
                  Store
                  <input
                    type="text"
                    [value]="user.storeId ?? ''"
                    disabled
                    data-testid="admin-user-form-store"
                  />
                </label>

                @if (roleRequiresStore(roleDraftControl(user.id).value)) {
                  <small data-testid="admin-user-form-store-required"
                    >StoreId es obligatorio para este rol.</small
                  >
                }

                <button type="submit" data-testid="admin-user-form-submit" [disabled]="loading()">
                  Guardar rol
                </button>
              </form>

              <button
                type="button"
                [attr.data-testid]="
                  isLocked(user) ? 'admin-users-unlock-' + user.id : 'admin-users-lock-' + user.id
                "
                (click)="onToggleLock(user)"
                [disabled]="loading()"
              >
                {{ isLocked(user) ? 'Desbloquear' : 'Bloquear' }}
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .users-admin {
      display: grid;
      gap: 1rem;
    }
    .header {
      display: grid;
      gap: 0.25rem;
    }
    .scope-badge {
      width: fit-content;
      border: 1px solid #d4d4d8;
      border-radius: 999px;
      padding: 0.25rem 0.75rem;
    }
    .filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .create-panel {
      border: 1px solid #e4e4e7;
      border-radius: 0.75rem;
      padding: 0.75rem;
      display: grid;
      gap: 0.5rem;
      max-width: 420px;
    }
    .user-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .user-row {
      border: 1px solid #e4e4e7;
      border-radius: 0.75rem;
      padding: 0.75rem;
      display: grid;
      gap: 0.5rem;
    }
    .inline-form {
      display: grid;
      gap: 0.5rem;
      max-width: 320px;
    }
    .success {
      color: #065f46;
    }
    .error {
      color: #b91c1c;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminPage {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly adminRolesService = inject(AdminRolesService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly tenantFilterControl = new FormControl('', { nonNullable: true });
  readonly storeFilterControl = new FormControl('', { nonNullable: true });

  readonly createTenantControl = new FormControl('', { nonNullable: true });
  readonly createStoreControl = new FormControl('', { nonNullable: true });
  readonly createRoleControl = new FormControl('', { nonNullable: true });

  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly roleOptions = signal<string[]>([]);
  readonly createFormVisible = signal(false);
  readonly createContextMessage = signal('');
  readonly createSuggestedRole = signal('');

  private readonly roleDrafts = signal<Record<string, FormControl<string>>>({});
  readonly createUserAvailable = false;
  private readonly initialTenantQuery = this.route.snapshot.queryParamMap.get('tenantId')?.trim() ?? '';
  private readonly initialStoreQuery = this.route.snapshot.queryParamMap.get('storeId')?.trim() ?? '';

  readonly scope = computed<AdminScope>(() => {
    if (this.authService.hasRole('SuperAdmin')) return 'global';
    if (this.authService.hasRole('TenantAdmin')) return 'tenant';
    if (this.authService.hasRole('AdminStore')) return 'store';
    return 'none';
  });

  readonly assignableRoles = computed(() => {
    if (this.scope() === 'global') {
      return ['SuperAdmin', 'TenantAdmin', 'AdminStore', 'Manager', 'Cashier'];
    }
    if (this.scope() === 'tenant') {
      return ['TenantAdmin', 'AdminStore', 'Manager', 'Cashier'];
    }
    if (this.scope() === 'store') {
      return ['Manager', 'Cashier'];
    }
    return [];
  });

  constructor() {
    const tenantIdQuery = this.initialTenantQuery;
    const storeIdQuery = this.initialStoreQuery;
    const searchQuery = this.route.snapshot.queryParamMap.get('search')?.trim() ?? '';

    this.searchControl.setValue(searchQuery);

    if (this.scope() === 'tenant') {
      this.tenantFilterControl.setValue(this.authService.getTenantId() ?? '');
      this.tenantFilterControl.disable();
    } else if (this.scope() === 'global' && tenantIdQuery) {
      this.tenantFilterControl.setValue(tenantIdQuery);
    }

    if (this.scope() === 'store') {
      this.storeFilterControl.setValue(this.authService.getStoreId() ?? '');
      this.storeFilterControl.disable();
    } else if (this.canFilterStore() && storeIdQuery) {
      this.storeFilterControl.setValue(storeIdQuery);
    }

    void this.loadRoles();
    void this.loadUsers();
  }

  scopeBadgeLabel() {
    if (this.scope() === 'global') return 'Vista global';
    if (this.scope() === 'tenant') return 'Vista del tenant';
    if (this.scope() === 'store') return 'Vista de sucursal';
    return 'Sin permisos';
  }

  canFilterTenant() {
    return this.scope() === 'global' || this.scope() === 'tenant';
  }

  canFilterStore() {
    return this.scope() !== 'none';
  }

  roleDraftControl(userId: string) {
    const current = this.roleDrafts()[userId];
    if (current) return current;
    const fallback = new FormControl('', { nonNullable: true });
    this.roleDrafts.update((drafts) => ({ ...drafts, [userId]: fallback }));
    return fallback;
  }

  roleRequiresStore(role: string | null | undefined) {
    if (!role) return false;
    return ['AdminStore', 'Manager', 'Cashier'].includes(role);
  }

  displayName(user: UserSummary) {
    return user.userName || user.fullName || user.email;
  }

  isLocked(user: UserSummary) {
    return user.isLockedOut ?? user.isLocked ?? false;
  }

  primaryRole(user: UserSummary) {
    return user.roles[0] ?? 'Sin rol';
  }

  async loadUsers() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const response = await this.adminUsersService.getUsers({
        page: 1,
        pageSize: 20,
        search: this.searchControl.value,
        tenantId: this.canFilterTenant() ? this.tenantFilterControl.value || null : null,
        storeId: this.canFilterStore() ? this.storeFilterControl.value || null : null,
      });
      this.users.set(response.items ?? []);
      const controls: Record<string, FormControl<string>> = {};
      for (const user of response.items ?? []) {
        controls[user.id] = new FormControl(this.primaryRole(user), { nonNullable: true });
      }
      this.roleDrafts.set(controls);
    } catch {
      this.errorMessage.set('No fue posible cargar usuarios para el alcance actual.');
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmitRoleUpdate(event: Event, user: UserSummary) {
    event.preventDefault();
    const role = this.roleDraftControl(user.id).value;

    if (this.roleRequiresStore(role) && !user.storeId) {
      this.errorMessage.set('StoreId es obligatorio para asignar ese rol.');
      return;
    }

    try {
      const updated = await this.adminUsersService.updateUserRoles(user.id, { roles: [role] });
      this.replaceUser(updated);
      this.successMessage.set('Rol actualizado correctamente.');
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(this.resolveErrorMessage(error, 'No fue posible actualizar el rol.'));
      this.successMessage.set('');
    }
  }

  onSubmitCreate(event: Event) {
    event.preventDefault();
    if (!this.createUserAvailable) {
      this.errorMessage.set('No existe endpoint backend para crear usuarios en el módulo de administración.');
      this.successMessage.set('');
    }
  }

  async onToggleLock(user: UserSummary) {
    try {
      const updated = await this.adminUsersService.setUserLockState(user.id, !this.isLocked(user));
      this.replaceUser(updated);
      this.successMessage.set(
        this.isLocked(updated)
          ? 'Usuario bloqueado correctamente.'
          : 'Usuario desbloqueado correctamente.',
      );
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(
        this.resolveErrorMessage(error, 'No fue posible cambiar el estado del usuario.'),
      );
      this.successMessage.set('');
    }
  }

  onSearch(event: Event) {
    event.preventDefault();
    void this.loadUsers();
  }

  openCreateFormFromContext() {
    const context = this.resolveContextFromFilters();
    this.createTenantControl.setValue(context.tenantId);
    this.createStoreControl.setValue(context.storeId);

    const suggestedRole = this.suggestRoleForContext(context.tenantId, context.storeId);
    this.createSuggestedRole.set(suggestedRole);
    this.createRoleControl.setValue(suggestedRole);

    if (context.tenantId && context.storeId) {
      this.createContextMessage.set('Se precargó la sucursal según el contexto actual.');
    } else if (context.tenantId) {
      this.createContextMessage.set('Se precargó el tenant según el contexto actual.');
    } else {
      this.createContextMessage.set('Formulario iniciado con valores neutros según tu alcance actual.');
    }

    this.createFormVisible.set(true);
  }

  private async loadRoles() {
    try {
      const roles = await this.adminRolesService.getRoles();
      this.roleOptions.set((roles ?? []).map((role) => role.name));
    } catch {
      this.roleOptions.set([]);
    }
  }

  private replaceUser(updated: UserSummary) {
    this.users.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    this.roleDraftControl(updated.id).setValue(this.primaryRole(updated));
  }

  private resolveErrorMessage(error: unknown, fallback: string) {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const payload = error.error as { detail?: string; errors?: Record<string, string[]> } | null;
    if (!payload) return fallback;
    const firstFieldError = payload.errors ? Object.values(payload.errors).flat()[0] : null;
    return firstFieldError || payload.detail || fallback;
  }

  private resolveContextFromFilters() {
    const tenantId =
      this.scope() === 'tenant' ? (this.authService.getTenantId() ?? '') : this.tenantFilterControl.value.trim();
    const storeId =
      this.scope() === 'store' ? (this.authService.getStoreId() ?? '') : this.storeFilterControl.value.trim();

    return {
      tenantId: tenantId || '',
      storeId: storeId || '',
    };
  }

  private suggestRoleForContext(tenantId: string, storeId: string) {
    if (tenantId && storeId) {
      if (this.scope() === 'store') {
        return 'Cashier';
      }
      return 'AdminStore';
    }
    if (tenantId) {
      return 'TenantAdmin';
    }
    return '';
  }
}
