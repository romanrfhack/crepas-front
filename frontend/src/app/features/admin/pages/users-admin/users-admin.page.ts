import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { RoleDto, UserSummary } from '../../models/admin.models';

@Component({
  selector: 'app-users-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="admin-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h1>👥 Administración de usuarios</h1>
        <p class="page-subtitle">Gestiona roles, permisos y estado de cuentas</p>
        <div class="header-decoration"></div>
      </header>

      <!-- BUSCADOR con estilo unificado -->
      <form class="search-form" (submit)="onSearch($event)">
        <div class="search-field">
          <label for="user-search">Buscar usuario</label>
          <div class="search-input-wrapper">
            <input
              id="user-search"
              type="search"
              [formControl]="searchControl"
              placeholder="Correo electrónico o nombre"
              class="search-input"
            />
            <button type="submit" class="btn-primary">
              <span>🔍</span> Buscar
            </button>
          </div>
        </div>
      </form>

      <!-- MENSAJES DE ERROR (mismo estilo que POS) -->
      @if (errorMessage()) {
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage() }}</span>
          <button type="button" class="error-dismiss" (click)="errorMessage.set('')">✕</button>
        </div>
      }

      <!-- ESTADO DE CARGA -->
      @if (loading()) {
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Cargando usuarios...</p>
        </div>
      } @else {
        <!-- LISTA DE USUARIOS -->
        @if (users().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>No se encontraron usuarios</p>
            <p class="empty-hint">Intenta con otros términos de búsqueda</p>
          </div>
        } @else {
          <ul class="users-list" aria-label="Listado de usuarios">
            @for (user of users(); track user.id) {
              <li class="user-card">
                <!-- Columna de información del usuario -->
                <div class="user-info">
                  <!-- <div class="user-avatar">
                    {{ user.fullName.charAt(0) || user.email.charAt(0) | uppercase }}
                  </div> -->
                  <div class="user-details">
                    <h2 class="user-name">{{ user.fullName || user.email }}</h2>
                    <p class="user-email">{{ user.email }}</p>
                    <div class="user-status">
                      <span
                        class="status-badge"
                        [class.status-badge--active]="!user.isLocked"
                        [class.status-badge--locked]="user.isLocked"
                      >
                        {{ user.isLocked ? '🔒 Bloqueado' : '✅ Activo' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Columna de acciones (roles y bloqueo) -->
                <div class="user-actions">
                  <div class="roles-control">
                    <label [for]="'roles-' + user.id" class="roles-label">
                      Roles (separados por coma)
                    </label>
                    <div class="roles-input-group">
                      <input
                        [id]="'roles-' + user.id"
                        class="roles-input"
                        [value]="userRoleDrafts()[user.id] || user.roles.join(', ')"
                        list="available-role-options"
                        (change)="onUserRolesDraftChange(user.id, $event)"
                        placeholder="Ej: AdminStore, Cashier"
                      />
                      <button
                        type="button"
                        class="btn-primary btn-small"
                        (click)="onUpdateRoles(user)"
                        [disabled]="loading()"
                      >
                        💾 Guardar
                      </button>
                    </div>
                  </div>

                  <div class="lock-control">
                    <button
                      type="button"
                      class="btn-outline btn-small"
                      [class.btn-danger]="!user.isLocked"
                      [class.btn-success]="user.isLocked"
                      (click)="onToggleLock(user)"
                      [disabled]="loading()"
                    >
                      @if (user.isLocked) {
                        <span>🔓 Desbloquear</span>
                      } @else {
                        <span>🔒 Bloquear</span>
                      }
                    </button>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      }

      <!-- DATALIST para sugerencias de roles -->
      <datalist id="available-role-options">
        @for (role of availableRoles(); track role.name) {
          <option [value]="role.name"></option>
        }
      </datalist>

      <!-- PAGINADOR con estilo elegante -->
      @if (!loading() && users().length > 0) {
        <footer class="pagination">
          <button
            type="button"
            class="pagination-btn"
            [disabled]="!canGoPrevious()"
            (click)="onChangePage(-1)"
          >
            <span class="pagination-icon">◀</span> Anterior
          </button>
          <div class="pagination-info">
            <span class="pagination-page">Página {{ page() }}</span>
            <span class="pagination-separator">·</span>
            <span class="pagination-total">{{ totalPages() }} total</span>
          </div>
          <button
            type="button"
            class="pagination-btn"
            [disabled]="!canGoNext()"
            (click)="onChangePage(1)"
          >
            Siguiente <span class="pagination-icon">▶</span>
          </button>
        </footer>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* Variables de diseño - mismas que en el POS */
      --brand-rose: #f3b6c2;
      --brand-rose-strong: #e89aac;
      --brand-cream: #fbf6ef;
      --brand-cocoa: #6b3f2a;
      --brand-ink: #0f172a;
      --brand-muted: #475569;
      --ring: rgba(232, 154, 172, 0.55);
      --border: rgba(243, 182, 194, 0.35);
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
      --shadow-sm: 0 8px 20px rgba(201, 141, 106, 0.12);
      --shadow-hover: 0 12px 28px rgba(201, 141, 106, 0.25);
      --radius-md: 0.75rem;
      --radius-lg: 22px;
      --transition: 140ms ease;
    }

    .admin-page {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }

    /* ===== HEADER ===== */
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    .page-header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      margin: 0;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .page-subtitle {
      margin: 0;
      color: var(--brand-muted);
      font-size: 1rem;
      font-weight: 500;
    }

    .header-decoration {
      width: 80px;
      height: 4px;
      background: linear-gradient(90deg, var(--brand-rose-strong), #c98d6a);
      border-radius: 999px;
      margin-top: 0.5rem;
    }

    /* ===== FORMULARIO DE BÚSQUEDA ===== */
    .search-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .search-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .search-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--brand-ink);
    }

    .search-input-wrapper {
      display: flex;
      gap: 0.5rem;
      align-items: stretch;
    }

    .search-input {
      flex: 1;
      padding: 0.7rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.95rem;
      transition: all var(--transition);
    }

    .search-input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .search-input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    /* ===== BOTONES ===== */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border: none;
      border-radius: 999px;
      padding: 0.7rem 1.6rem;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 20px rgba(201, 141, 106, 0.25);
      transition: transform var(--transition), filter var(--transition), box-shadow var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .btn-primary:hover:not([disabled]) {
      transform: translateY(-2px);
      filter: saturate(1.1) brightness(0.98);
      box-shadow: 0 12px 28px rgba(201, 141, 106, 0.4);
    }

    .btn-primary[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
      filter: grayscale(0.4);
    }

    .btn-small {
      padding: 0.5rem 1.2rem;
      font-size: 0.85rem;
    }

    .btn-outline {
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.5rem 1.2rem;
      font-weight: 600;
      color: var(--brand-cocoa);
      transition: all var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-outline:hover:not([disabled]) {
      background: rgba(243, 182, 194, 0.1);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .btn-outline[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-danger {
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.3);
    }

    .btn-danger:hover:not([disabled]) {
      background: rgba(180, 35, 24, 0.08);
      border-color: #b42318;
    }

    .btn-success {
      color: #065f46;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .btn-success:hover:not([disabled]) {
      background: rgba(16, 185, 129, 0.08);
      border-color: #10b981;
    }

    /* ===== ERROR MESSAGE ===== */
    .error-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      border-radius: var(--radius-md);
      color: #b42318;
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

    .error-icon {
      font-size: 1.1rem;
    }

    .error-dismiss {
      margin-left: auto;
      background: transparent;
      border: none;
      color: #b42318;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      transition: background var(--transition);
    }

    .error-dismiss:hover {
      background: rgba(180, 35, 24, 0.1);
    }

    @keyframes slide-down {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ===== ESTADO DE CARGA ===== */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      gap: 1rem;
      color: var(--brand-muted);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--brand-rose-strong);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ===== ESTADO VACÍO ===== */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
      background: rgba(243, 182, 194, 0.08);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      color: var(--brand-muted);
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.7;
    }

    .empty-state p {
      margin: 0;
      font-weight: 500;
    }

    .empty-hint {
      font-size: 0.9rem;
      margin-top: 0.5rem;
      color: var(--brand-muted);
      opacity: 0.8;
    }

    /* ===== LISTA DE USUARIOS ===== */
    .users-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
    }

    .user-card {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 1.5rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      transition: all var(--transition);
    }

    .user-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: 0 12px 24px rgba(201, 141, 106, 0.12);
      transform: translateY(-2px);
    }

    /* Columna de información */
    .user-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .user-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      font-weight: 700;
      font-size: 1.2rem;
      border-radius: 999px;
      box-shadow: 0 4px 12px rgba(201, 141, 106, 0.3);
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .user-name {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--brand-ink);
    }

    .user-email {
      margin: 0;
      font-size: 0.9rem;
      color: var(--brand-muted);
    }

    .user-status {
      margin-top: 0.35rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      background: white;
      border: 1px solid transparent;
    }

    .status-badge--active {
      background: rgba(16, 185, 129, 0.1);
      color: #065f46;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-badge--locked {
      background: rgba(180, 35, 24, 0.1);
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.3);
    }

    /* Columna de acciones */
    .user-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .roles-control {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .roles-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-ink);
    }

    .roles-input-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .roles-input {
      flex: 1;
      padding: 0.5rem 0.9rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.9rem;
      transition: all var(--transition);
    }

    .roles-input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .roles-input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .lock-control {
      display: flex;
      justify-content: flex-start;
    }

    /* ===== PAGINADOR ===== */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .pagination-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.2rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      font-weight: 600;
      color: var(--brand-cocoa);
      transition: all var(--transition);
      cursor: pointer;
    }

    .pagination-btn:hover:not([disabled]) {
      background: rgba(243, 182, 194, 0.1);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .pagination-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-icon {
      font-size: 0.8rem;
    }

    .pagination-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--brand-muted);
      font-weight: 500;
    }

    .pagination-page {
      font-weight: 700;
      color: var(--brand-ink);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .user-card {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .user-actions {
        padding-left: 0;
        border-left: none;
      }
    }

    @media (max-width: 600px) {
      .admin-page {
        padding: 1rem;
      }

      .search-input-wrapper {
        flex-direction: column;
      }

      .roles-input-group {
        flex-direction: column;
        align-items: stretch;
      }

      .pagination {
        flex-direction: column;
        gap: 0.75rem;
      }
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