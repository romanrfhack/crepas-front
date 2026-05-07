import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminUsersService } from '../../services/admin-users.service';
import {
  AdminUserOptions,
  AllowedActions,
  CreateAdminUserRequestDto,
  UserSummary,
} from '../../models/admin.models';

type UserStatusFilter = '' | 'active' | 'locked';

@Component({
  selector: 'app-users-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="users-admin" data-testid="admin-users-page">
      <header class="header">
        <div>
          <h1>Administración de usuarios</h1>
          <p class="subtitle">{{ scopeLabel() }}</p>
        </div>
        <button
          type="button"
          class="primary"
          data-testid="admin-users-create-open"
          (click)="openCreateFormFromContext()"
          [disabled]="optionsLoading() || roleOptions().length === 0"
        >
          Nuevo usuario
        </button>
      </header>

      <form class="filters" (submit)="onSearch($event)">
        <label>
          Buscar
          <input
            type="search"
            [formControl]="searchControl"
            placeholder="Nombre o correo"
            data-testid="admin-users-filter-search"
          />
        </label>

        <label>
          Rol
          <select
            [formControl]="roleFilterControl"
            data-testid="admin-users-filter-role"
            (change)="onFilterChanged()"
          >
            <option value="">Todos los roles</option>
            @for (role of roleOptions(); track role.name) {
              <option [value]="role.name">{{ role.displayName }}</option>
            }
          </select>
        </label>

        @if (canChooseTenant()) {
          <label>
            Empresa
            <select
              [formControl]="tenantFilterControl"
              data-testid="admin-users-filter-tenant"
              (change)="onTenantFilterChanged()"
            >
              <option value="">Todas las empresas</option>
              @for (tenant of tenantOptions(); track tenant.id) {
                <option [value]="tenant.id">{{ tenant.name }}</option>
              }
            </select>
          </label>
        }

        @if (canChooseStore()) {
          <label>
            Sucursal
            <select
              [formControl]="storeFilterControl"
              data-testid="admin-users-filter-store"
              (change)="onFilterChanged()"
            >
              <option value="">Todas las sucursales</option>
              @for (store of filterStoreOptions(); track store.id) {
                <option [value]="store.id">{{ store.name }}</option>
              }
            </select>
          </label>
        }

        <label>
          Estado
          <select
            [formControl]="statusFilterControl"
            data-testid="admin-users-filter-status"
            (change)="onFilterChanged()"
          >
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="locked">Bloqueado</option>
          </select>
        </label>

        <button type="submit">Buscar</button>
      </form>

      @if (createFormVisible()) {
        <section class="panel" data-testid="admin-users-create-context-badge">
          @if (createIntentActive()) {
            <p class="muted" data-testid="admin-users-create-intent-active">
              Alta contextual automática activa.
            </p>
          }
          <h2>Nuevo usuario</h2>
          <p class="muted">{{ createContextMessage() }}</p>
          <p data-testid="admin-users-create-context-tenant">
            Empresa: {{ selectedTenantName(createTenantControl.value) || 'Sin seleccionar' }}
          </p>
          <p data-testid="admin-users-create-context-store">
            Sucursal: {{ selectedStoreName(createStoreControl.value) || 'Sin seleccionar' }}
          </p>

          <form class="form-grid" data-testid="admin-user-form" (submit)="onSubmitCreate($event)">
            <label>
              Rol
              <select [formControl]="createRoleControl" data-testid="admin-user-form-role">
                <option value="">Selecciona un rol</option>
                @for (role of roleOptions(); track role.name) {
                  <option [value]="role.name">{{ role.displayName }}</option>
                }
              </select>
            </label>

            <label>
              Empresa
              <select
                [formControl]="createTenantControl"
                data-testid="admin-user-form-tenant"
                (change)="onCreateTenantChanged()"
              >
                <option value="">Selecciona una empresa</option>
                @for (tenant of tenantOptions(); track tenant.id) {
                  <option [value]="tenant.id">{{ tenant.name }}</option>
                }
              </select>
            </label>

            <label>
              Sucursal
              <select
                [formControl]="createStoreControl"
                data-testid="admin-user-form-store"
              >
                <option value="">Sin sucursal</option>
                @for (store of createStoreOptions(); track store.id) {
                  <option [value]="store.id">{{ store.name }}</option>
                }
              </select>
            </label>

            <label>
              Correo
              <input
                type="email"
                [formControl]="createEmailControl"
                data-testid="admin-user-form-email"
              />
            </label>

            <label>
              Nombre de usuario
              <input
                type="text"
                [formControl]="createUserNameControl"
                data-testid="admin-user-form-username"
              />
            </label>

            <label>
              Contraseña temporal
              <input
                type="password"
                [formControl]="createPasswordControl"
                data-testid="admin-user-form-password"
              />
            </label>

            <div class="actions-row">
              <button
                type="submit"
                class="primary"
                data-testid="admin-user-form-submit"
                [disabled]="createSubmitting()"
              >
                {{ createSubmitting() ? 'Creando...' : 'Crear usuario' }}
              </button>
              <button
                type="button"
                data-testid="admin-users-create-close"
                [disabled]="createSubmitting()"
                (click)="closeCreateForm()"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      }

      @if (successMessage()) {
        <div class="success" data-testid="admin-user-form-success">{{ successMessage() }}</div>
      }
      @if (errorMessage()) {
        <div class="error" data-testid="admin-user-form-error">{{ errorMessage() }}</div>
      }

      <section class="table-shell">
        <div class="table-header">
          <p>{{ totalCount() }} usuarios</p>
          <label>
            Por página
            <select
              [formControl]="pageSizeControl"
              data-testid="admin-users-page-size"
              (change)="onPageSizeChanged()"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>

        @if (loading()) {
          <p class="empty">Cargando usuarios...</p>
        } @else if (users().length === 0) {
          <p class="empty">Sin resultados para los filtros actuales.</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Empresa</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr [attr.data-testid]="'admin-users-row-' + user.id">
                  <td>{{ displayName(user) }}</td>
                  <td>{{ user.email }}</td>
                  <td [attr.data-testid]="'admin-users-role-' + user.id">
                    {{ roleLabel(user) }}
                  </td>
                  <td>{{ tenantLabel(user) }}</td>
                  <td [attr.data-testid]="'admin-users-store-' + user.id">
                    {{ storeLabel(user) }}
                  </td>
                  <td>{{ statusLabel(user) }}</td>
                  <td>
                    <div class="row-actions">
                      @if (allowed(user).canChangeRole) {
                        <form class="role-form" (submit)="onSubmitRoleUpdate($event, user)">
                          <select
                            [formControl]="roleDraftControl(user.id)"
                            [attr.aria-label]="'Rol de ' + displayName(user)"
                            data-testid="admin-user-role-update"
                          >
                            @for (role of roleOptions(); track role.name) {
                              <option [value]="role.name">{{ role.displayName }}</option>
                            }
                          </select>
                          <button type="submit" data-testid="admin-user-role-update-submit">
                            Guardar rol
                          </button>
                        </form>
                      }

                      @if (allowed(user).canResetTemporaryPassword) {
                        <button
                          type="button"
                          [attr.data-testid]="'admin-users-reset-password-open-' + user.id"
                          (click)="openResetPassword(user)"
                        >
                          Restablecer contraseña
                        </button>
                      }

                      @if (allowed(user).canEdit) {
                        <button
                          type="button"
                          [attr.data-testid]="'admin-users-edit-open-' + user.id"
                          (click)="openEditUser(user)"
                        >
                          Editar
                        </button>
                      }

                      @if (allowed(user).canLock) {
                        <button
                          type="button"
                          [attr.data-testid]="'admin-users-lock-' + user.id"
                          (click)="onToggleLock(user)"
                        >
                          Bloquear
                        </button>
                      }

                      @if (allowed(user).canUnlock) {
                        <button
                          type="button"
                          [attr.data-testid]="'admin-users-unlock-' + user.id"
                          (click)="onToggleLock(user)"
                        >
                          Desbloquear
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }

        <nav class="pagination" aria-label="Paginación de usuarios">
          <button
            type="button"
            data-testid="admin-users-prev-page"
            [disabled]="page() <= 1 || loading()"
            (click)="goToPage(page() - 1)"
          >
            Anterior
          </button>
          <span data-testid="admin-users-page-indicator">
            Página {{ page() }} de {{ totalPages() }}
          </span>
          <button
            type="button"
            data-testid="admin-users-next-page"
            [disabled]="page() >= totalPages() || loading()"
            (click)="goToPage(page() + 1)"
          >
            Siguiente
          </button>
        </nav>
      </section>

      @if (resetPasswordModalOpen() && resetTargetUser()) {
        <section class="modal" data-testid="admin-users-reset-password-modal">
          <h2>Restablecer contraseña temporal</h2>
          <p data-testid="admin-users-reset-password-user">
            {{ displayName(resetTargetUser()!) }} · {{ resetTargetUser()!.email }}
          </p>

          <form class="form-grid" (submit)="onSubmitResetPassword($event)">
            <label>
              Contraseña temporal
              <input
                type="password"
                [formControl]="resetPasswordControl"
                data-testid="admin-users-reset-password-password"
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                [formControl]="resetPasswordConfirmControl"
                data-testid="admin-users-reset-password-confirm"
              />
            </label>

            @if (resetPasswordError()) {
              <div class="error" data-testid="admin-users-reset-password-error">
                {{ resetPasswordError() }}
              </div>
            }

            @if (resetPasswordSuccess()) {
              <div class="success" data-testid="admin-users-reset-password-success">
                {{ resetPasswordSuccess() }}
              </div>
            }

            <div class="actions-row">
              <button
                type="submit"
                class="primary"
                data-testid="admin-users-reset-password-submit"
                [disabled]="resetPasswordSubmitting()"
              >
                {{ resetPasswordSubmitting() ? 'Guardando...' : 'Restablecer' }}
              </button>
              <button
                type="button"
                data-testid="admin-users-reset-password-cancel"
                [disabled]="resetPasswordSubmitting()"
                (click)="closeResetPasswordModal()"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      }

      @if (editModalOpen() && editTargetUser()) {
        <section class="modal" data-testid="admin-user-edit-form">
          <h2>Editar usuario</h2>
          <p>{{ editTargetUser()!.email }}</p>

          <form class="form-grid" (submit)="onSubmitEditUser($event)">
            <label>
              Nombre de usuario
              <input
                type="text"
                [formControl]="editUserNameControl"
                data-testid="admin-user-edit-username"
              />
            </label>

            <label>
              Empresa
              <select
                [formControl]="editTenantControl"
                data-testid="admin-user-edit-tenant"
                (change)="onEditTenantChanged()"
              >
                <option value="">Selecciona una empresa</option>
                @for (tenant of tenantOptions(); track tenant.id) {
                  <option [value]="tenant.id">{{ tenant.name }}</option>
                }
              </select>
            </label>

            <label>
              Sucursal
              <select
                [formControl]="editStoreControl"
                data-testid="admin-user-edit-store"
              >
                <option value="">Sin sucursal</option>
                @for (store of editStoreOptions(); track store.id) {
                  <option [value]="store.id">{{ store.name }}</option>
                }
              </select>
            </label>

            @if (editError()) {
              <div class="error" data-testid="admin-user-edit-error">{{ editError() }}</div>
            }

            @if (editSuccess()) {
              <div class="success" data-testid="admin-user-edit-success">{{ editSuccess() }}</div>
            }

            <div class="actions-row">
              <button type="submit" class="primary" data-testid="admin-user-edit-submit" [disabled]="editSubmitting()">
                {{ editSubmitting() ? 'Guardando...' : 'Guardar' }}
              </button>
              <button
                type="button"
                data-testid="admin-user-edit-cancel"
                [disabled]="editSubmitting()"
                (click)="closeEditUserModal()"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      }
    </section>
  `,
  styles: `
    .users-admin {
      display: grid;
      gap: 1rem;
    }

    .header,
    .table-header,
    .pagination,
    .actions-row,
    .row-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .header,
    .table-header {
      justify-content: space-between;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    .subtitle,
    .muted {
      color: #52525b;
    }

    .filters,
    .form-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      align-items: end;
    }

    label {
      display: grid;
      gap: 0.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #18181b;
    }

    input,
    select,
    button {
      min-height: 2.35rem;
      border: 1px solid #d4d4d8;
      border-radius: 0.5rem;
      padding: 0.45rem 0.65rem;
      background: #ffffff;
      color: #18181b;
      font: inherit;
    }

    button {
      cursor: pointer;
      font-weight: 700;
    }

    button:disabled,
    select:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .primary {
      border-color: #0f766e;
      background: #0f766e;
      color: #ffffff;
    }

    .panel,
    .modal,
    .table-shell {
      border: 1px solid #e4e4e7;
      border-radius: 0.5rem;
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
      background: #ffffff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid #e4e4e7;
      padding: 0.65rem;
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: #52525b;
    }

    .role-form {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .success {
      color: #047857;
      font-weight: 700;
    }

    .error {
      color: #b91c1c;
      font-weight: 700;
    }

    .empty {
      color: #52525b;
      padding: 1rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminPage {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly roleFilterControl = new FormControl('', { nonNullable: true });
  readonly tenantFilterControl = new FormControl('', { nonNullable: true });
  readonly storeFilterControl = new FormControl('', { nonNullable: true });
  readonly statusFilterControl = new FormControl<UserStatusFilter>('', { nonNullable: true });
  readonly pageSizeControl = new FormControl('20', { nonNullable: true });

  readonly createTenantControl = new FormControl('', { nonNullable: true });
  readonly createStoreControl = new FormControl('', { nonNullable: true });
  readonly createRoleControl = new FormControl('', { nonNullable: true });
  readonly createEmailControl = new FormControl('', { nonNullable: true });
  readonly createUserNameControl = new FormControl('', { nonNullable: true });
  readonly createPasswordControl = new FormControl('', { nonNullable: true });

  readonly resetPasswordControl = new FormControl('', { nonNullable: true });
  readonly resetPasswordConfirmControl = new FormControl('', { nonNullable: true });

  readonly editUserNameControl = new FormControl('', { nonNullable: true });
  readonly editTenantControl = new FormControl('', { nonNullable: true });
  readonly editStoreControl = new FormControl('', { nonNullable: true });

  readonly users = signal<UserSummary[]>([]);
  readonly options = signal<AdminUserOptions | null>(null);
  readonly loading = signal(false);
  readonly optionsLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly totalCount = signal(0);
  readonly page = signal(1);

  readonly createFormVisible = signal(false);
  readonly createContextMessage = signal('');
  readonly createSubmitting = signal(false);
  readonly createIntentActive = signal(false);

  readonly resetPasswordModalOpen = signal(false);
  readonly resetTargetUser = signal<UserSummary | null>(null);
  readonly resetPasswordSubmitting = signal(false);
  readonly resetPasswordError = signal('');
  readonly resetPasswordSuccess = signal('');

  readonly editModalOpen = signal(false);
  readonly editTargetUser = signal<UserSummary | null>(null);
  readonly editSubmitting = signal(false);
  readonly editError = signal('');
  readonly editSuccess = signal('');

  private readonly roleDrafts = signal<Record<string, FormControl<string>>>({});

  readonly roleOptions = computed(() => this.options()?.roles ?? []);
  readonly tenantOptions = computed(() => this.options()?.tenants ?? []);
  readonly storeOptions = computed(() => this.options()?.stores ?? []);
  readonly scopeLabel = computed(() => {
    const scope = this.options()?.currentScope;
    if (!scope) return 'Cargando alcance permitido...';
    const tenant = scope.tenantName ? ` · ${scope.tenantName}` : '';
    const store = scope.storeName ? ` · ${scope.storeName}` : '';
    return `Alcance actual: ${scope.roleDisplayName || this.roleDisplayName(scope.role)}${tenant}${store}`;
  });

  constructor() {
    this.hydrateFromQueryParams();
    void this.initialize();
  }

  canChooseTenant() {
    return this.tenantOptions().length > 1;
  }

  canChooseStore() {
    return this.filterStoreOptions().length > 1;
  }

  createTenantLocked() {
    return this.tenantOptions().length <= 1;
  }

  createStoreLocked() {
    return this.createStoreOptions().length <= 1;
  }

  editScopeLocked() {
    const target = this.editTargetUser();
    return !target?.allowedActions?.canChangeScope;
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.totalCount() / this.currentPageSize()));
  }

  filterStoreOptions() {
    return this.storesForTenant(this.tenantFilterControl.value);
  }

  createStoreOptions() {
    return this.storesForTenant(this.createTenantControl.value);
  }

  editStoreOptions() {
    return this.storesForTenant(this.editTenantControl.value);
  }

  roleDraftControl(userId: string) {
    const current = this.roleDrafts()[userId];
    if (current) return current;
    const fallback = new FormControl('', { nonNullable: true });
    this.roleDrafts.update((drafts) => ({ ...drafts, [userId]: fallback }));
    return fallback;
  }

  displayName(user: UserSummary) {
    return user.displayName || user.userName || user.fullName || user.email;
  }

  roleLabel(user: UserSummary) {
    return user.primaryRole?.displayName || this.roleDisplayName(user.roles[0] ?? '') || 'Sin rol';
  }

  tenantLabel(user: UserSummary) {
    return user.tenant?.name || 'Sin empresa';
  }

  storeLabel(user: UserSummary) {
    return user.store?.name || 'Sin sucursal';
  }

  statusLabel(user: UserSummary) {
    return user.status?.label || (this.isLocked(user) ? 'Bloqueado' : 'Activo');
  }

  allowed(user: UserSummary): AllowedActions {
    return (
      user.allowedActions ?? {
        canEdit: false,
        canChangeRole: false,
        canChangeScope: false,
        canLock: false,
        canUnlock: false,
        canResetTemporaryPassword: false,
      }
    );
  }

  isLocked(user: UserSummary) {
    return user.status?.isLockedOut ?? user.isLockedOut ?? user.isLocked ?? false;
  }

  selectedTenantName(tenantId: string) {
    return this.tenantOptions().find((tenant) => tenant.id === tenantId)?.name ?? '';
  }

  selectedStoreName(storeId: string) {
    return this.storeOptions().find((store) => store.id === storeId)?.name ?? '';
  }

  onSearch(event: Event) {
    event.preventDefault();
    this.page.set(1);
    void this.loadUsersAndSyncQuery();
  }

  onFilterChanged() {
    this.page.set(1);
    void this.loadUsersAndSyncQuery();
  }

  onTenantFilterChanged() {
    const storeId = this.storeFilterControl.value;
    if (storeId && !this.filterStoreOptions().some((store) => store.id === storeId)) {
      this.storeFilterControl.setValue('');
    }
    this.onFilterChanged();
  }

  onCreateTenantChanged() {
    const storeId = this.createStoreControl.value;
    if (storeId && !this.createStoreOptions().some((store) => store.id === storeId)) {
      this.createStoreControl.setValue('');
    }
    const stores = this.createStoreOptions();
    if (!this.createStoreControl.value && stores.length === 1) {
      this.createStoreControl.setValue(stores[0].id);
    }
    this.syncCreateScopeControlState();
  }

  onEditTenantChanged() {
    const storeId = this.editStoreControl.value;
    if (storeId && !this.editStoreOptions().some((store) => store.id === storeId)) {
      this.editStoreControl.setValue('');
    }
    this.syncEditScopeControlState();
  }

  onPageSizeChanged() {
    this.page.set(1);
    void this.loadUsersAndSyncQuery();
  }

  goToPage(page: number) {
    const nextPage = Math.min(Math.max(1, page), this.totalPages());
    if (nextPage === this.page()) return;
    this.page.set(nextPage);
    void this.loadUsersAndSyncQuery();
  }

  async loadUsers() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const response = await this.adminUsersService.getUsers({
        page: this.page(),
        pageSize: this.currentPageSize(),
        search: this.searchControl.value,
        role: this.roleFilterControl.value || null,
        tenantId: this.tenantFilterControl.value || null,
        storeId: this.storeFilterControl.value || null,
        status: this.statusFilterControl.value || null,
      });

      const items = response.items ?? [];
      this.users.set(items);
      this.totalCount.set(response.totalCount ?? response.total ?? items.length);
      const controls = Object.fromEntries(
        items.map((user) => [
          user.id,
          new FormControl(user.primaryRole?.name ?? user.roles[0] ?? '', { nonNullable: true }),
        ]),
      ) as Record<string, FormControl<string>>;
      this.roleDrafts.set(controls);
    } catch (error) {
      this.errorMessage.set(this.resolveUserMessage(error, 'No fue posible cargar usuarios.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmitRoleUpdate(event: Event, user: UserSummary) {
    event.preventDefault();
    const role = this.roleDraftControl(user.id).value;
    if (!role) {
      this.errorMessage.set('Selecciona un rol.');
      return;
    }

    try {
      const updated = await this.adminUsersService.updateUserRoles(user.id, { roles: [role] });
      this.replaceUser(updated);
      this.successMessage.set('Rol actualizado correctamente.');
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(
        this.resolveUserMessage(error, 'El rol seleccionado no está permitido para tu perfil.'),
      );
      this.successMessage.set('');
    }
  }

  async onSubmitCreate(event: Event) {
    event.preventDefault();
    if (this.createSubmitting()) return;

    const validationError = this.validateCreateForm();
    if (validationError) {
      this.errorMessage.set(validationError);
      this.successMessage.set('');
      return;
    }

    this.createSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.adminUsersService.createUser(this.buildCreateRequest());
      this.createEmailControl.setValue('');
      this.createUserNameControl.setValue('');
      this.createPasswordControl.setValue('');
      await this.loadUsers();
      this.successMessage.set('Usuario creado correctamente.');
    } catch (error) {
      this.errorMessage.set(this.resolveUserMessage(error, 'No fue posible crear el usuario.'));
    } finally {
      this.createSubmitting.set(false);
    }
  }

  async onToggleLock(user: UserSummary) {
    try {
      const updated = await this.adminUsersService.setUserLockState(user.id, !this.isLocked(user));
      this.replaceUser(updated);
      this.successMessage.set(this.isLocked(updated) ? 'Usuario bloqueado.' : 'Usuario desbloqueado.');
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(
        this.resolveUserMessage(error, 'No tienes permiso para administrar este usuario.'),
      );
      this.successMessage.set('');
    }
  }

  openCreateFormFromContext(options: { suggestedRole?: string; source?: 'manual' | 'intent' } = {}) {
    const tenantId = this.resolveCreateTenant();
    const storeId = this.resolveCreateStore(tenantId);
    this.createTenantControl.setValue(tenantId);
    this.createStoreControl.setValue(storeId);
    this.createRoleControl.setValue(this.resolveSuggestedRole(options.suggestedRole, tenantId, storeId));
    this.createContextMessage.set(this.buildCreateContextMessage(tenantId, storeId));
    this.createIntentActive.set(options.source === 'intent');
    this.createFormVisible.set(true);
    this.syncCreateScopeControlState();
  }

  closeCreateForm() {
    this.createFormVisible.set(false);
    this.createIntentActive.set(false);
  }

  openResetPassword(user: UserSummary) {
    this.resetTargetUser.set(user);
    this.resetPasswordModalOpen.set(true);
    this.resetPasswordControl.setValue('');
    this.resetPasswordConfirmControl.setValue('');
    this.resetPasswordError.set('');
    this.resetPasswordSuccess.set('');
  }

  closeResetPasswordModal() {
    this.resetPasswordModalOpen.set(false);
    this.resetTargetUser.set(null);
    this.resetPasswordControl.setValue('');
    this.resetPasswordConfirmControl.setValue('');
    this.resetPasswordError.set('');
    this.resetPasswordSuccess.set('');
    this.resetPasswordSubmitting.set(false);
  }

  async onSubmitResetPassword(event: Event) {
    event.preventDefault();
    if (this.resetPasswordSubmitting()) return;

    const targetUser = this.resetTargetUser();
    if (!targetUser) return;

    const validationError = this.validateResetPasswordForm();
    if (validationError) {
      this.resetPasswordError.set(validationError);
      this.resetPasswordSuccess.set('');
      return;
    }

    this.resetPasswordSubmitting.set(true);
    this.resetPasswordError.set('');
    this.resetPasswordSuccess.set('');

    try {
      const response = await this.adminUsersService.setTemporaryPassword(targetUser.id, {
        temporaryPassword: this.resetPasswordControl.value.trim(),
      });
      this.resetPasswordControl.setValue('');
      this.resetPasswordConfirmControl.setValue('');
      this.resetPasswordSuccess.set(response.message || 'Contraseña temporal restablecida.');
    } catch (error) {
      this.resetPasswordError.set(
        this.resolveUserMessage(error, 'No fue posible restablecer la contraseña temporal.'),
      );
    } finally {
      this.resetPasswordSubmitting.set(false);
    }
  }

  openEditUser(user: UserSummary) {
    this.editTargetUser.set(user);
    this.editModalOpen.set(true);
    this.editUserNameControl.setValue(user.userName ?? this.displayName(user));
    this.editTenantControl.setValue(user.tenant?.id ?? user.tenantId ?? '');
    this.editStoreControl.setValue(user.store?.id ?? user.storeId ?? '');
    this.editError.set('');
    this.editSuccess.set('');
    this.syncEditScopeControlState();
  }

  closeEditUserModal() {
    this.editModalOpen.set(false);
    this.editTargetUser.set(null);
    this.editUserNameControl.setValue('');
    this.editTenantControl.setValue('');
    this.editStoreControl.setValue('');
    this.editSubmitting.set(false);
    this.editError.set('');
    this.editSuccess.set('');
  }

  async onSubmitEditUser(event: Event) {
    event.preventDefault();
    if (this.editSubmitting()) return;

    const target = this.editTargetUser();
    if (!target) return;

    const validationError = this.validateEditForm();
    if (validationError) {
      this.editError.set(validationError);
      this.editSuccess.set('');
      return;
    }

    this.editSubmitting.set(true);
    this.editError.set('');
    this.editSuccess.set('');

    try {
      await this.adminUsersService.updateUser(target.id, {
        userName: this.editUserNameControl.value.trim(),
        tenantId: this.editTenantControl.value || null,
        storeId: this.editStoreControl.value || null,
      });
      await this.loadUsers();
      this.editSuccess.set('Usuario actualizado correctamente.');
    } catch (error) {
      this.editError.set(this.resolveUserMessage(error, 'No fue posible actualizar el usuario.'));
    } finally {
      this.editSubmitting.set(false);
    }
  }

  private async initialize() {
    await this.loadOptions();
    this.applyFixedScopeDefaults();

    if (this.route.snapshot.queryParamMap.get('intent')?.trim() === 'create-user') {
      this.openCreateFormFromContext({
        suggestedRole: this.route.snapshot.queryParamMap.get('suggestedRole')?.trim() || undefined,
        source: 'intent',
      });
    }

    await this.loadUsers();
  }

  private async loadOptions() {
    this.optionsLoading.set(true);
    try {
      const options = await this.adminUsersService.getUserOptions();
      this.options.set(options);
    } catch (error) {
      this.errorMessage.set(this.resolveUserMessage(error, 'No fue posible cargar opciones.'));
    } finally {
      this.optionsLoading.set(false);
    }
  }

  private hydrateFromQueryParams() {
    const query = this.route.snapshot.queryParamMap;
    this.searchControl.setValue(query.get('search')?.trim() ?? '');
    this.roleFilterControl.setValue(query.get('role')?.trim() ?? '');
    this.tenantFilterControl.setValue(query.get('tenantId')?.trim() ?? '');
    this.storeFilterControl.setValue(query.get('storeId')?.trim() ?? '');
    this.statusFilterControl.setValue((query.get('status')?.trim() as UserStatusFilter) ?? '');
    this.page.set(this.parsePositiveInt(query.get('page'), 1));
    this.pageSizeControl.setValue(String(this.parsePositiveInt(query.get('pageSize'), 20)));
  }

  private applyFixedScopeDefaults() {
    if (this.tenantOptions().length === 1) {
      this.tenantFilterControl.setValue(this.tenantOptions()[0].id);
    }

    if (this.storeOptions().length === 1) {
      this.storeFilterControl.setValue(this.storeOptions()[0].id);
    }
  }

  private async loadUsersAndSyncQuery() {
    await this.updateQueryParams();
    await this.loadUsers();
  }

  private updateQueryParams() {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.searchControl.value.trim() || null,
        role: this.roleFilterControl.value || null,
        tenantId: this.tenantFilterControl.value || null,
        storeId: this.storeFilterControl.value || null,
        status: this.statusFilterControl.value || null,
        page: this.page(),
        pageSize: this.currentPageSize(),
      },
    });
  }

  private currentPageSize() {
    return this.parsePositiveInt(this.pageSizeControl.value, 20);
  }

  private storesForTenant(tenantId: string) {
    const normalizedTenantId = tenantId.trim();
    return normalizedTenantId
      ? this.storeOptions().filter((store) => store.tenantId === normalizedTenantId)
      : this.storeOptions();
  }

  private roleDisplayName(roleName: string) {
    return this.roleOptions().find((role) => role.name === roleName)?.displayName || roleName;
  }

  private resolveSuggestedRole(explicitSuggestedRole: string | undefined, tenantId: string, storeId: string) {
    const explicit = explicitSuggestedRole?.trim();
    if (explicit && this.roleOptions().some((role) => role.name === explicit)) {
      return explicit;
    }

    const preferred = storeId ? ['AdminStore', 'Manager', 'Cashier'] : ['TenantAdmin', 'AdminStore', 'User'];
    return preferred.find((role) => this.roleOptions().some((option) => option.name === role)) ?? '';
  }

  private resolveCreateTenant() {
    return this.tenantFilterControl.value || (this.tenantOptions().length === 1 ? this.tenantOptions()[0].id : '');
  }

  private resolveCreateStore(tenantId: string) {
    const stores = this.storesForTenant(tenantId);
    return this.storeFilterControl.value || (stores.length === 1 ? stores[0].id : '');
  }

  private buildCreateContextMessage(tenantId: string, storeId: string) {
    if (tenantId && storeId) return 'Se precargó la empresa y sucursal de tu alcance actual.';
    if (tenantId) return 'Se precargó la empresa de tu alcance actual.';
    return 'Selecciona la empresa y, si aplica, una sucursal.';
  }

  private syncCreateScopeControlState() {
    this.setControlDisabled(this.createTenantControl, this.createTenantLocked());
    this.setControlDisabled(this.createStoreControl, this.createStoreLocked());
  }

  private syncEditScopeControlState() {
    const locked = this.editScopeLocked();
    this.setControlDisabled(this.editTenantControl, locked || this.tenantOptions().length <= 1);
    this.setControlDisabled(this.editStoreControl, locked || this.editStoreOptions().length <= 1);
  }

  private setControlDisabled(control: FormControl<string>, disabled: boolean) {
    if (disabled && control.enabled) {
      control.disable({ emitEvent: false });
    } else if (!disabled && control.disabled) {
      control.enable({ emitEvent: false });
    }
  }

  private validateCreateForm() {
    const email = this.createEmailControl.value.trim();
    const userName = this.createUserNameControl.value.trim();
    const role = this.createRoleControl.value.trim();
    const password = this.createPasswordControl.value.trim();
    const tenantId = this.createTenantControl.value.trim();
    const storeId = this.createStoreControl.value.trim();

    if (!email || !userName || !role || !password) {
      return 'Completa correo, nombre de usuario, rol y contraseña temporal.';
    }

    if (!tenantId) {
      return 'Selecciona una empresa.';
    }

    if (this.roleRequiresStore(role) && !storeId) {
      return 'Selecciona una sucursal.';
    }

    return '';
  }

  private validateEditForm() {
    if (!this.editUserNameControl.value.trim()) {
      return 'El nombre de usuario es obligatorio.';
    }

    if (!this.editTenantControl.value.trim()) {
      return 'Selecciona una empresa.';
    }

    const target = this.editTargetUser();
    const requiresStore = target?.roles.some((role) => this.roleRequiresStore(role)) ?? false;
    if (requiresStore && !this.editStoreControl.value.trim()) {
      return 'Selecciona una sucursal.';
    }

    return '';
  }

  private validateResetPasswordForm() {
    const password = this.resetPasswordControl.value.trim();
    const confirmPassword = this.resetPasswordConfirmControl.value.trim();

    if (!password || !confirmPassword) return 'Captura y confirma la contraseña temporal.';
    if (password.length < 8) return 'La contraseña temporal debe tener al menos 8 caracteres.';
    if (password !== confirmPassword) return 'La confirmación de contraseña no coincide.';
    return '';
  }

  private roleRequiresStore(role: string | null | undefined) {
    return Boolean(role && ['AdminStore', 'Manager', 'Cashier', 'Collector'].includes(role));
  }

  private buildCreateRequest(): CreateAdminUserRequestDto {
    return {
      email: this.createEmailControl.value.trim(),
      userName: this.createUserNameControl.value.trim(),
      role: this.createRoleControl.value.trim(),
      tenantId: this.createTenantControl.value || null,
      storeId: this.createStoreControl.value || null,
      temporaryPassword: this.createPasswordControl.value.trim(),
    };
  }

  private replaceUser(updated: UserSummary) {
    this.users.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    this.roleDraftControl(updated.id).setValue(updated.primaryRole?.name ?? updated.roles[0] ?? '');
  }

  private resolveUserMessage(error: unknown, fallback: string) {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const payload = error.error as { detail?: string; errors?: Record<string, string[]> } | null;
    const firstFieldError = payload?.errors ? Object.values(payload.errors).flat()[0] : null;
    return this.humanizeTechnicalTerms(firstFieldError || payload?.detail || fallback);
  }

  private humanizeTechnicalTerms(message: string) {
    return message
      .replaceAll('TenantId', 'empresa')
      .replaceAll('tenantId', 'empresa')
      .replaceAll('Tenant', 'empresa')
      .replaceAll('tenant', 'empresa')
      .replaceAll('StoreId', 'sucursal')
      .replaceAll('storeId', 'sucursal')
      .replaceAll('Store', 'sucursal')
      .replaceAll('store', 'sucursal')
      .replaceAll('UserName', 'nombre de usuario')
      .replaceAll('TemporaryPassword', 'contraseña temporal')
      .replaceAll('Target user is outside your role hierarchy.', 'No tienes permiso para administrar este usuario.')
      .replaceAll('Roles not allowed for your scope', 'El rol seleccionado no está permitido para tu perfil');
  }

  private parsePositiveInt(value: string | null, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
