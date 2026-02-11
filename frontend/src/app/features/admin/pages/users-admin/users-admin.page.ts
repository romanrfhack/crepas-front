import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { RoleDto, UserSummary } from '../../models/admin.models';

@Component({
  selector: 'app-users-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Administración de usuarios</h1>
        <p>Gestiona roles y bloqueo de cuentas.</p>
      </header>

      <form class="search-row" (submit)="onSearch($event)">
        <label for="user-search">Buscar usuario</label>
        <input
          id="user-search"
          type="search"
          [formControl]="searchControl"
          placeholder="Email o nombre"
        />
        <button type="submit">Buscar</button>
      </form>

      @if (errorMessage()) {
        <p role="alert" class="inline-error">{{ errorMessage() }}</p>
      }

      @if (loading()) {
        <p>Cargando usuarios...</p>
      } @else {
        <ul class="users-list" aria-label="Listado de usuarios">
          @for (user of users(); track user.id) {
            <li class="user-card">
              <div>
                <h2>{{ user.fullName || user.email }}</h2>
                <p>{{ user.email }}</p>
                <p>
                  Estado:
                  <strong>{{ user.isLocked ? 'Bloqueado' : 'Activo' }}</strong>
                </p>
              </div>

              <div class="actions">
                <label [for]="'roles-' + user.id">Roles (separados por coma)</label>
                <input
                  [id]="'roles-' + user.id"
                  [value]="user.roles.join(', ')"
                  list="available-role-options"
                  (change)="onUserRolesDraftChange(user.id, $event)"
                />
                <div class="buttons">
                  <button type="button" (click)="onUpdateRoles(user)">Guardar roles</button>
                  <button type="button" (click)="onToggleLock(user)">
                    {{ user.isLocked ? 'Desbloquear' : 'Bloquear' }}
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }

      <datalist id="available-role-options">
        @for (role of availableRoles(); track role.name) {
          <option [value]="role.name"></option>
        }
      </datalist>

      <footer class="pager">
        <button type="button" (click)="onChangePage(-1)" [disabled]="!canGoPrevious()">
          Anterior
        </button>
        <span>Página {{ page() }} de {{ totalPages() }}</span>
        <button type="button" (click)="onChangePage(1)" [disabled]="!canGoNext()">Siguiente</button>
      </footer>
    </section>
  `,
  styles: `
    .admin-page {
      width: min(1000px, 100%);
      display: grid;
      gap: 1rem;
    }
    .page-header h1 {
      margin: 0;
    }
    .page-header p {
      margin: 0.25rem 0 0;
      color: #475569;
    }
    .search-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.5rem;
      align-items: end;
    }
    .search-row label {
      grid-column: 1 / -1;
      font-weight: 600;
    }
    .search-row input,
    .actions input {
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      padding: 0.5rem;
      font: inherit;
    }
    .search-row button,
    .actions button,
    .pager button {
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 0.5rem;
      padding: 0.5rem 0.8rem;
      cursor: pointer;
    }
    .users-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .user-card {
      display: grid;
      gap: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem;
      background: #fff;
    }
    .user-card h2,
    .user-card p {
      margin: 0;
    }
    .actions {
      display: grid;
      gap: 0.5rem;
    }
    .buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
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
export class UsersAdminPage {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly adminRolesService = inject(AdminRolesService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly users = signal<UserSummary[]>([]);
  readonly availableRoles = signal<RoleDto[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly totalCount = signal(0);
  readonly userRoleDrafts = signal<Record<string, string>>({});

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
  readonly canGoPrevious = computed(() => this.page() > 1);
  readonly canGoNext = computed(() => this.page() < this.totalPages());

  constructor() {
    void this.loadRoles();
    void this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.adminUsersService.getUsers({
        page: this.page(),
        pageSize: this.pageSize,
        search: this.searchControl.value,
      });
      this.users.set(response.items ?? []);
      this.totalCount.set(response.totalCount ?? 0);
      this.userRoleDrafts.set(
        (response.items ?? []).reduce<Record<string, string>>((accumulator, user) => {
          accumulator[user.id] = user.roles.join(', ');
          return accumulator;
        }, {}),
      );
    } catch {
      this.errorMessage.set('No fue posible cargar usuarios.');
    } finally {
      this.loading.set(false);
    }
  }

  async onUpdateRoles(user: UserSummary) {
    const draftRoles = this.userRoleDrafts()[user.id] ?? '';
    const roles = draftRoles
      .split(',')
      .map((role) => role.trim())
      .filter((role) => Boolean(role));

    try {
      const updatedUser = await this.adminUsersService.updateUserRoles(user.id, { roles });
      this.updateUser(updatedUser);
    } catch {
      this.errorMessage.set('No pudimos actualizar los roles del usuario.');
    }
  }

  async onToggleLock(user: UserSummary) {
    try {
      const updatedUser = await this.adminUsersService.setUserLockState(user.id, !user.isLocked);
      this.updateUser(updatedUser);
    } catch {
      this.errorMessage.set('No pudimos cambiar el estado de bloqueo.');
    }
  }

  onSearch(event: Event) {
    event.preventDefault();
    this.page.set(1);
    void this.loadUsers();
  }

  onChangePage(offset: number) {
    const newPage = this.page() + offset;
    if (newPage < 1 || newPage > this.totalPages()) {
      return;
    }

    this.page.set(newPage);
    void this.loadUsers();
  }

  onUserRolesDraftChange(userId: string, event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.userRoleDrafts.update((current) => ({
      ...current,
      [userId]: input.value,
    }));
  }

  private async loadRoles() {
    try {
      const roles = await this.adminRolesService.getRoles();
      this.availableRoles.set(roles ?? []);
    } catch {
      this.availableRoles.set([]);
    }
  }

  private updateUser(user: UserSummary) {
    this.users.update((currentUsers) =>
      currentUsers.map((currentUser) => (currentUser.id === user.id ? user : currentUser)),
    );
    this.userRoleDrafts.update((currentDrafts) => ({
      ...currentDrafts,
      [user.id]: user.roles.join(', '),
    }));
  }
}
