import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminRolesService } from '../../services/admin-roles.service';
import { RoleDto } from '../../models/admin.models';

@Component({
  selector: 'app-roles-admin-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="admin-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h1>⚙️ Administración de roles</h1>
        <p class="page-subtitle">Crea y elimina roles del sistema</p>
        <div class="header-decoration"></div>
      </header>

      <!-- FORMULARIO DE CREACIÓN DE ROL -->
      <form class="create-role-form" (submit)="onCreateRole($event)">
        <div class="form-field">
          <label for="role-name">Nuevo rol</label>
          <div class="form-input-group">
            <input
              id="role-name"
              type="text"
              [formControl]="roleNameControl"
              placeholder="Ej: Supervisor, Auditor, Jefe de turno"
              class="form-input"
            />
            <button
              type="submit"
              class="btn-primary"
              [disabled]="roleNameControl.invalid || loading()"
            >
              <span>✨</span> Crear rol
            </button>
          </div>
          @if (roleNameControl.invalid && roleNameControl.touched) {
            <div class="field-error">
              El nombre debe tener al menos 2 caracteres
            </div>
          }
        </div>
      </form>

      <!-- MENSAJE DE ERROR (mismo estilo que POS) -->
      @if (errorMessage()) {
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage() }}</span>
          <button type="button" class="error-dismiss" (click)="errorMessage.set('')">✕</button>
        </div>
      }

      <!-- ESTADO DE CARGA -->
      @if (loading() && roles().length === 0) {
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Cargando roles...</p>
        </div>
      }

      <!-- LISTA DE ROLES -->
      @if (!loading() || roles().length > 0) {
        @if (roles().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">🏷️</span>
            <p>No hay roles creados</p>
            <p class="empty-hint">Crea un rol para comenzar</p>
          </div>
        } @else {
          <div class="roles-header">
            <h2 class="roles-title">Roles existentes</h2>
            <span class="roles-count">{{ roles().length }} {{ roles().length === 1 ? 'rol' : 'roles' }}</span>
          </div>

          <ul class="roles-list" aria-label="Listado de roles">
            @for (role of roles(); track role.name) {
              <li class="role-item">
                <div class="role-info">
                  <span class="role-icon">🔑</span>
                  <span class="role-name">{{ role.name }}</span>
                </div>
                <button
                  type="button"
                  class="btn-outline btn-danger"
                  (click)="onDeleteRole(role)"
                  [disabled]="loading()"
                >
                  🗑️ Eliminar
                </button>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* Variables de diseño - mismas que en el POS y UsersAdminPage */
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
      max-width: 800px;
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

    /* ===== FORMULARIO DE CREACIÓN ===== */
    .create-role-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--brand-ink);
    }

    .form-input-group {
      display: flex;
      gap: 0.5rem;
      align-items: stretch;
    }

    .form-input {
      flex: 1;
      padding: 0.7rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.95rem;
      transition: all var(--transition);
    }

    .form-input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .form-input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .field-error {
      font-size: 0.8rem;
      color: #b42318;
      margin-top: 0.15rem;
      padding-left: 0.5rem;
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
      padding: 2.5rem;
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
      padding: 2.5rem 2rem;
      text-align: center;
      background: rgba(243, 182, 194, 0.08);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      color: var(--brand-muted);
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
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

    /* ===== ENCABEZADO DE LISTA ===== */
    .roles-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-top: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .roles-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--brand-ink);
      margin: 0;
    }

    .roles-count {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
    }

    /* ===== LISTA DE ROLES ===== */
    .roles-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }

    .role-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1rem 1.25rem;
      transition: all var(--transition);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
    }

    .role-item:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: 0 12px 24px rgba(201, 141, 106, 0.12);
      transform: translateY(-2px);
    }

    .role-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .role-icon {
      font-size: 1.2rem;
      color: var(--brand-cocoa);
    }

    .role-name {
      font-weight: 700;
      font-size: 1rem;
      color: var(--brand-ink);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 600px) {
      .admin-page {
        padding: 1rem;
      }

      .form-input-group {
        flex-direction: column;
      }

      .btn-primary {
        width: 100%;
      }

      .role-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .btn-outline {
        align-self: flex-end;
      }
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
      this.roleNameControl.markAsTouched();
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
      this.roleNameControl.markAsUntouched();
    } catch {
      this.errorMessage.set('No fue posible crear el rol.');
    } finally {
      this.loading.set(false);
    }
  }

  async onDeleteRole(role: RoleDto) {
    // Confirmación antes de eliminar
    if (!confirm(`¿Estás seguro de eliminar el rol "${role.name}"?`)) {
      return;
    }

    this.errorMessage.set('');
    try {
      await this.adminRolesService.deleteRole(role.name);
      this.roles.update((current) => current.filter((currentRole) => currentRole.name !== role.name));
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