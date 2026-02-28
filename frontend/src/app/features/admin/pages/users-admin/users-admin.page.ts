import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { CreateAdminUserRequestDto, UserSummary } from '../../models/admin.models';

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
          @if (createIntentActive()) {
            <p data-testid="admin-users-create-intent-active">Alta contextual automática activa.</p>
          }
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

            <label>
              Email
              <input
                type="email"
                [formControl]="createEmailControl"
                data-testid="admin-user-form-email"
              />
            </label>

            <label>
              UserName
              <input
                type="text"
                [formControl]="createUserNameControl"
                data-testid="admin-user-form-username"
              />
            </label>

            <label>
              Temporary password
              <input
                type="password"
                [formControl]="createPasswordControl"
                data-testid="admin-user-form-password"
              />
            </label>

            <div class="actions-row">
              <button
                type="submit"
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
                Cerrar
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

              @if (canResetTemporaryPassword(user)) {
                <button
                  type="button"
                  [attr.data-testid]="'admin-users-reset-password-open-' + user.id"
                  (click)="openResetPassword(user)"
                  [disabled]="loading()"
                >
                  Restablecer contraseña
                </button>
              }

              <button
                type="button"
                [attr.data-testid]="'admin-users-edit-open-' + user.id"
                (click)="openEditUser(user)"
                [disabled]="loading()"
              >
                Editar
              </button>

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

      @if (resetPasswordModalOpen() && resetTargetUser()) {
        <section class="reset-modal" data-testid="admin-users-reset-password-modal">
          <h2>Restablecer contraseña temporal</h2>
          <p data-testid="admin-users-reset-password-user">
            {{ displayName(resetTargetUser()!) }} ({{ resetTargetUser()!.email }})
          </p>

          <form class="inline-form" (submit)="onSubmitResetPassword($event)">
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

            <small>
              Contraseña temporal para acceso inicial. No se muestra ni se persiste en la UI. Mínimo 8
              caracteres.
            </small>

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
        <section class="reset-modal" data-testid="admin-user-edit-form">
          <h2>Editar usuario</h2>
          <p>{{ editTargetUser()!.email }}</p>

          <form class="inline-form" (submit)="onSubmitEditUser($event)">
            <label>
              UserName
              <input
                type="text"
                [formControl]="editUserNameControl"
                data-testid="admin-user-edit-username"
              />
            </label>

            <label>
              Tenant
              <input
                type="text"
                [formControl]="editTenantControl"
                data-testid="admin-user-edit-tenant"
              />
            </label>

            <label>
              Store
              <input
                type="text"
                [formControl]="editStoreControl"
                data-testid="admin-user-edit-store"
              />
            </label>

            @if (editStoreRequiredForCurrentRoles()) {
              <small data-testid="admin-user-edit-store-required"
                >StoreId es obligatorio para los roles actuales.</small
              >
            }

            @if (editError()) {
              <div class="error" data-testid="admin-user-edit-error">{{ editError() }}</div>
            }

            @if (editSuccess()) {
              <div class="success" data-testid="admin-user-edit-success">{{ editSuccess() }}</div>
            }

            <div class="actions-row">
              <button type="submit" data-testid="admin-user-edit-submit" [disabled]="editSubmitting()">
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
    .actions-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .reset-modal {
      border: 1px solid #e4e4e7;
      border-radius: 0.75rem;
      padding: 0.75rem;
      max-width: 420px;
      display: grid;
      gap: 0.5rem;
      background: #ffffff;
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
  readonly createEmailControl = new FormControl('', { nonNullable: true });
  readonly createUserNameControl = new FormControl('', { nonNullable: true });
  readonly createPasswordControl = new FormControl('', { nonNullable: true });

  readonly resetPasswordControl = new FormControl('', { nonNullable: true });
  readonly resetPasswordConfirmControl = new FormControl('', { nonNullable: true });

  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly roleOptions = signal<string[]>([]);
  readonly createFormVisible = signal(false);
  readonly createContextMessage = signal('');
  readonly createSuggestedRole = signal('');
  readonly createSubmitting = signal(false);
  readonly createIntentActive = signal(false);
  readonly resetPasswordModalOpen = signal(false);
  readonly resetTargetUser = signal<UserSummary | null>(null);
  readonly resetPasswordSubmitting = signal(false);
  readonly resetPasswordError = signal('');
  readonly resetPasswordSuccess = signal('');
  readonly editModalOpen = signal(false);
  readonly editTargetUser = signal<UserSummary | null>(null);
  readonly editUserNameControl = new FormControl('', { nonNullable: true });
  readonly editTenantControl = new FormControl('', { nonNullable: true });
  readonly editStoreControl = new FormControl('', { nonNullable: true });
  readonly editSubmitting = signal(false);
  readonly editError = signal('');
  readonly editSuccess = signal('');

  private readonly roleDrafts = signal<Record<string, FormControl<string>>>({});
  private readonly initialTenantQuery = this.route.snapshot.queryParamMap.get('tenantId')?.trim() ?? '';
  private readonly initialStoreQuery = this.route.snapshot.queryParamMap.get('storeId')?.trim() ?? '';
  private readonly initialIntentQuery = this.route.snapshot.queryParamMap.get('intent')?.trim() ?? '';
  private readonly initialSuggestedRoleQuery =
    this.route.snapshot.queryParamMap.get('suggestedRole')?.trim() ?? '';

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

    if (this.initialIntentQuery === 'create-user') {
      this.openCreateFormFromContext({
        suggestedRole: this.initialSuggestedRoleQuery || undefined,
        source: 'intent',
      });
    }
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

  canResetTemporaryPassword(user: UserSummary) {
    const targetRole = this.primaryRole(user);
    if (!['TenantAdmin', 'AdminStore', 'Manager', 'Cashier'].includes(targetRole)) {
      return false;
    }

    if (this.scope() === 'global') {
      return true;
    }

    if (this.scope() === 'tenant') {
      const actorTenantId = this.authService.getTenantId();
      return !actorTenantId || user.tenantId === actorTenantId;
    }

    if (this.scope() === 'store') {
      if (!['Manager', 'Cashier'].includes(targetRole)) {
        return false;
      }
      const actorStoreId = this.authService.getStoreId();
      return !actorStoreId || user.storeId === actorStoreId;
    }

    return false;
  }

  openEditUser(user: UserSummary) {
    this.editTargetUser.set(user);
    this.editModalOpen.set(true);
    this.editUserNameControl.setValue(user.userName ?? '');
    this.editTenantControl.setValue(user.tenantId ?? '');
    this.editStoreControl.setValue(user.storeId ?? '');
    this.editError.set('');
    this.editSuccess.set('');
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

  editStoreRequiredForCurrentRoles() {
    const user = this.editTargetUser();
    return user ? user.roles.some((role) => this.roleRequiresStore(role)) : false;
  }

  editTenantRequiredForCurrentRoles() {
    const user = this.editTargetUser();
    return user
      ? user.roles.some((role) => ['TenantAdmin', 'AdminStore', 'Manager', 'Cashier'].includes(role))
      : false;
  }

  async onSubmitEditUser(event: Event) {
    event.preventDefault();

    if (this.editSubmitting()) {
      return;
    }

    const target = this.editTargetUser();
    if (!target) {
      return;
    }

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
        tenantId: this.editTenantControl.value.trim() || null,
        storeId: this.editStoreControl.value.trim() || null,
      });
      await this.loadUsers();
      this.editSuccess.set('Usuario actualizado correctamente.');
      this.editError.set('');
    } catch (error) {
      this.editError.set(this.resolveEditErrorMessage(error));
      this.editSuccess.set('');
    } finally {
      this.editSubmitting.set(false);
    }
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
    if (this.resetPasswordSubmitting()) {
      return;
    }

    const targetUser = this.resetTargetUser();
    if (!targetUser) {
      return;
    }

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
      this.resetPasswordError.set(this.resolveResetPasswordErrorMessage(error));
    } finally {
      this.resetPasswordSubmitting.set(false);
    }
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

  async onSubmitCreate(event: Event) {
    event.preventDefault();
    if (this.createSubmitting()) {
      return;
    }

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
      this.successMessage.set('Usuario creado.');
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(this.resolveCreateErrorMessage(error));
    } finally {
      this.createSubmitting.set(false);
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

  openCreateFormFromContext(options: { suggestedRole?: string; source?: 'manual' | 'intent' } = {}) {
    const context = this.resolveContextFromFilters();
    this.createTenantControl.setValue(context.tenantId);
    this.createStoreControl.setValue(context.storeId);

    const suggestedRole = this.resolveSuggestedRole(options.suggestedRole, context.tenantId, context.storeId);
    this.createSuggestedRole.set(suggestedRole);
    this.createRoleControl.setValue(suggestedRole);

    if (context.tenantId && context.storeId) {
      this.createContextMessage.set('Se precargó la sucursal según el contexto actual.');
    } else if (context.tenantId) {
      this.createContextMessage.set('Se precargó el tenant según el contexto actual.');
    } else {
      this.createContextMessage.set('Formulario iniciado con valores neutros según tu alcance actual.');
    }

    this.createIntentActive.set(options.source === 'intent');
    this.createFormVisible.set(true);
  }

  closeCreateForm() {
    this.createFormVisible.set(false);
    this.createIntentActive.set(false);
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

  private validateCreateForm() {
    const email = this.createEmailControl.value.trim();
    const userName = this.createUserNameControl.value.trim();
    const role = this.createRoleControl.value.trim();
    const password = this.createPasswordControl.value.trim();
    const tenantId = this.createTenantControl.value.trim();
    const storeId = this.createStoreControl.value.trim();

    if (!email || !userName || !role || !password) {
      return 'Completa email, username, rol y contraseña temporal.';
    }

    if (this.roleRequiresStore(role) && !storeId) {
      return 'StoreId es obligatorio para asignar ese rol.';
    }

    if ((role === 'AdminStore' || role === 'Manager' || role === 'Cashier') && !tenantId) {
      return 'TenantId es obligatorio para asignar ese rol.';
    }

    return '';
  }

  private validateResetPasswordForm() {
    const password = this.resetPasswordControl.value.trim();
    const confirmPassword = this.resetPasswordConfirmControl.value.trim();

    if (!password || !confirmPassword) {
      return 'Captura y confirma la contraseña temporal.';
    }

    if (password.length < 8) {
      return 'La contraseña temporal debe tener al menos 8 caracteres.';
    }

    if (password !== confirmPassword) {
      return 'La confirmación de contraseña no coincide.';
    }

    return '';
  }

  private validateEditForm() {
    const userName = this.editUserNameControl.value.trim();
    const tenantId = this.editTenantControl.value.trim();
    const storeId = this.editStoreControl.value.trim();

    if (!userName) {
      return 'UserName es obligatorio.';
    }

    if (this.editTenantRequiredForCurrentRoles() && !tenantId) {
      return 'TenantId es obligatorio para los roles actuales del usuario.';
    }

    if (this.editStoreRequiredForCurrentRoles() && !storeId) {
      return 'StoreId es obligatorio para los roles actuales del usuario.';
    }

    return '';
  }

  private resolveEditErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No fue posible actualizar el usuario.';
    }

    if ([400, 403, 404, 409].includes(error.status)) {
      return this.resolveErrorMessage(error, 'No fue posible actualizar el usuario.');
    }

    return this.resolveErrorMessage(error, 'No fue posible actualizar el usuario.');
  }

  private resolveResetPasswordErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No fue posible restablecer la contraseña temporal.';
    }

    if (error.status === 403) {
      return this.resolveErrorMessage(error, 'No tienes permisos para restablecer la contraseña.');
    }

    if (error.status === 404) {
      return this.resolveErrorMessage(error, 'El usuario objetivo no existe.');
    }

    if (error.status === 400) {
      return this.resolveErrorMessage(error, 'La contraseña no cumple la política requerida.');
    }

    return this.resolveErrorMessage(error, 'No fue posible restablecer la contraseña temporal.');
  }

  private buildCreateRequest(): CreateAdminUserRequestDto {
    return {
      email: this.createEmailControl.value.trim(),
      userName: this.createUserNameControl.value.trim(),
      role: this.createRoleControl.value.trim(),
      tenantId: this.createTenantControl.value.trim() || null,
      storeId: this.createStoreControl.value.trim() || null,
      temporaryPassword: this.createPasswordControl.value.trim(),
    };
  }

  private resolveCreateErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No fue posible crear el usuario.';
    }

    if (error.status === 409) {
      return this.resolveErrorMessage(error, 'El email o username ya existe.');
    }

    if (error.status === 400) {
      return this.resolveErrorMessage(error, 'Datos inválidos para crear el usuario.');
    }

    return this.resolveErrorMessage(error, 'No fue posible crear el usuario.');
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

  private resolveSuggestedRole(explicitSuggestedRole: string | undefined, tenantId: string, storeId: string) {
    const candidate = explicitSuggestedRole?.trim() ?? '';
    if (candidate && this.assignableRoles().includes(candidate)) {
      return candidate;
    }

    const contextSuggestion = this.suggestRoleForContext(tenantId, storeId);
    return this.assignableRoles().includes(contextSuggestion) ? contextSuggestion : '';
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
