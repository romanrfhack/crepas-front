import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformTenantStoreListItemDto } from '../../models/platform.models';
import { PlatformStoresApiService } from '../../services/platform-stores-api.service';

@Component({
  selector: 'app-platform-tenant-stores-page',
  template: `
    <div class="tenant-stores-page" data-testid="platform-tenant-stores-page">
      <!-- HEADER con título y contexto -->
      <header class="page-header">
        <h2>🏬 Tiendas del tenant</h2>
        <p class="page-subtitle">Administra las sucursales y sus configuraciones</p>
        <div class="header-decoration"></div>
      </header>

      <!-- BADGE DE CONTEXTO (filtro sin AdminStore) -->
      @if (showWithoutAdminOnly()) {
        <div class="context-badge-group">
          <span
            class="context-badge filter-badge"
            data-testid="platform-tenant-stores-context-without-admin"
          >
            🔍 Mostrando solo stores sin AdminStore
          </span>
          <span
            class="context-badge info-badge"
            data-testid="platform-tenant-stores-context-badge"
          >
            ⚠️ Contexto activo: resolución de stores sin AdminStore
          </span>
        </div>
      }

      <!-- MENSAJES DE ÉXITO / ERROR -->
      @if (success()) {
        <div class="success-message" data-testid="platform-tenant-stores-success">
          <span class="message-icon">✅</span>
          <span>{{ success() }}</span>
        </div>
      }
      @if (error()) {
        <div class="error-message" data-testid="platform-tenant-stores-error">
          <span class="message-icon">⚠️</span>
          <span>{{ error() }}</span>
        </div>
      }

      <!-- ESTADO DE CARGA -->
      @if (loading()) {
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Cargando tiendas...</p>
        </div>
      } @else {
        <!-- TARJETA PRINCIPAL CON TABLA -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">📋</span>
            <h3>Listado de tiendas</h3>
            @if (visibleStores().length > 0) {
              <span class="count-badge">{{ visibleStores().length }} tienda(s)</span>
            }
          </div>

          @if (visibleStores().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">🏬</span>
              <p>No hay tiendas para mostrar</p>
              <p class="empty-hint">
                {{ showWithoutAdminOnly() ? 'Todas las tiendas tienen AdminStore' : 'Crea una nueva tienda' }}
              </p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Zona horaria</th>
                    <th>Estado</th>
                    <th>AdminStore</th>
                    <th class="numeric">AdminStore users</th>
                    <th class="numeric">Total users</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (store of visibleStores(); track store.id) {
                    <tr
                      [attr.data-testid]="'platform-tenant-stores-row-' + store.id"
                      [class.highlight-row]="store.isDefaultStore || !store.hasAdminStore"
                    >
                      <td>
                        <strong>{{ store.name }}</strong>
                        <div class="secondary-info">{{ store.id }}</div>
                      </td>
                      <td>{{ store.timeZoneId }}</td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-badge--default]="store.isDefaultStore"
                          [attr.data-testid]="'platform-tenant-stores-default-' + store.id"
                        >
                          {{ store.isDefaultStore ? 'Principal' : 'Regular' }}
                        </span>
                      </td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-badge--success]="store.hasAdminStore"
                          [class.status-badge--warning]="!store.hasAdminStore"
                          [attr.data-testid]="'platform-tenant-stores-has-admin-' + store.id"
                        >
                          {{ store.hasAdminStore ? 'Con AdminStore' : 'Sin AdminStore' }}
                        </span>
                      </td>
                      <td class="numeric">{{ store.adminStoreUserCount }}</td>
                      <td class="numeric">{{ store.totalUsersInStore }}</td>
                      <td class="actions-cell">
                        @if (!store.hasAdminStore) {
                          <button
                            type="button"
                            class="btn-primary btn-small"
                            [attr.data-testid]="'platform-tenant-stores-create-adminstore-' + store.id"
                            (click)="createAdminStore(store)"
                          >
                            ➕ Crear AdminStore
                          </button>
                        }

                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'platform-tenant-stores-view-details-' + store.id"
                          (click)="openDetails(store.id)"
                        >
                          👁️ Ver detalle
                        </button>

                        @if (!store.isDefaultStore) {
                          <button
                            type="button"
                            class="btn-outline btn-small"
                            [attr.data-testid]="'platform-tenant-stores-set-default-' + store.id"
                            [disabled]="settingDefaultStoreId() === store.id"
                            (click)="setAsDefault(store.id)"
                          >
                            ⭐ Hacer principal
                          </button>
                        }

                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'platform-tenant-stores-users-' + store.id"
                          (click)="goToUsers(store)"
                        >
                          👥 Usuarios
                        </button>

                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'platform-tenant-stores-dashboard-' + store.id"
                          (click)="goToDashboard(store)"
                        >
                          📊 Dashboard
                        </button>

                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'platform-tenant-stores-inventory-' + store.id"
                          (click)="goToInventory(store)"
                        >
                          📦 Inventario
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* Variables de diseño - mismas que en el resto del sistema */
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
      --radius-card: 18px;
      --transition: 140ms ease;
    }

    .tenant-stores-page {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    /* ===== HEADER ===== */
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    .page-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .page-subtitle {
      margin: 0;
      color: var(--brand-muted);
      font-size: 0.95rem;
      font-weight: 500;
    }

    .header-decoration {
      width: 60px;
      height: 4px;
      background: linear-gradient(90deg, var(--brand-rose-strong), #c98d6a);
      border-radius: 999px;
      margin-top: 0.25rem;
    }

    /* ===== BADGES DE CONTEXTO ===== */
    .context-badge-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .context-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 1rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid transparent;
    }

    .filter-badge {
      background: rgba(245, 158, 11, 0.1);
      color: #b45309;
      border-color: rgba(245, 158, 11, 0.3);
    }

    .info-badge {
      background: rgba(59, 130, 246, 0.1);
      color: #1e40af;
      border-color: rgba(59, 130, 246, 0.3);
    }

    /* ===== TARJETA DE SECCIÓN ===== */
    .section-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .section-icon {
      font-size: 1.5rem;
      color: var(--brand-cocoa);
    }

    .section-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--brand-ink);
    }

    .count-badge {
      margin-left: auto;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== TABLA ===== */
    .table-responsive {
      overflow-x: auto;
      border-radius: var(--radius-md);
    }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .modern-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      background: rgba(243, 182, 194, 0.12);
      color: var(--brand-cocoa);
      font-weight: 700;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
    }

    .modern-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--brand-ink);
    }

    .modern-table tr:last-child td {
      border-bottom: none;
    }

    .modern-table tbody tr {
      transition: background var(--transition);
    }

    .modern-table tbody tr:hover {
      background: rgba(243, 182, 194, 0.06);
    }

    .highlight-row {
      background: rgba(243, 182, 194, 0.04);
    }

    .secondary-info {
      font-size: 0.75rem;
      color: var(--brand-muted);
      margin-top: 0.1rem;
    }

    .numeric {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ===== BADGES DE ESTADO ===== */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: white;
      border: 1px solid transparent;
    }

    .status-badge--default {
      background: rgba(16, 185, 129, 0.1);
      color: #065f46;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-badge--success {
      background: rgba(16, 185, 129, 0.1);
      color: #065f46;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-badge--warning {
      background: rgba(245, 158, 11, 0.1);
      color: #b45309;
      border-color: rgba(245, 158, 11, 0.3);
    }

    /* ===== CELDA DE ACCIONES ===== */
    .actions-cell {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      align-items: center;
      min-width: 200px;
    }

    /* ===== BOTONES ===== */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border: none;
      border-radius: 999px;
      padding: 0.5rem 1.2rem;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 20px rgba(201, 141, 106, 0.25);
      transition: transform var(--transition), filter var(--transition), box-shadow var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
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
      font-size: 0.85rem;
      color: var(--brand-cocoa);
      transition: all var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
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

    .btn-small {
      padding: 0.4rem 0.9rem;
      font-size: 0.8rem;
    }

    /* ===== MENSAJES DE ÉXITO / ERROR ===== */
    .success-message,
    .error-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

    .success-message {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #065f46;
    }

    .error-message {
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      color: #b42318;
    }

    .message-icon {
      font-size: 1.1rem;
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

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .actions-cell {
        flex-direction: column;
        align-items: stretch;
      }

      .btn-primary,
      .btn-outline {
        width: 100%;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .modern-table th,
      .modern-table td {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantStoresPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PlatformStoresApiService);

  readonly loading = signal(true);
  readonly stores = signal<PlatformTenantStoreListItemDto[]>([]);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly settingDefaultStoreId = signal<string | null>(null);
  readonly showWithoutAdminOnly = signal(false);
  readonly visibleStores = signal<PlatformTenantStoreListItemDto[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) {
      this.error.set('Tenant inválido.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const stores = await this.api.getTenantStores(tenantId);
      const showWithoutAdminOnly =
        this.route.snapshot.queryParamMap.get('withoutAdminStore') === 'true';
      this.showWithoutAdminOnly.set(showWithoutAdminOnly);
      this.stores.set(stores);
      this.visibleStores.set(
        showWithoutAdminOnly ? stores.filter((store) => !store.hasAdminStore) : stores,
      );
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.loading.set(false);
    }
  }

  openDetails(storeId: string): void {
    void this.router.navigate(['/app/platform/stores', storeId]);
  }

  async setAsDefault(storeId: string): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) {
      return;
    }

    this.settingDefaultStoreId.set(storeId);
    this.error.set(null);
    this.success.set(null);

    try {
      await this.api.updateTenantDefaultStore(tenantId, { defaultStoreId: storeId });
      this.success.set('Sucursal principal actualizada.');
      await this.load();
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.settingDefaultStoreId.set(null);
    }
  }

  goToUsers(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/users'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }

  goToDashboard(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/platform/dashboard'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }

  goToInventory(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/pos/inventory'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }

  createAdminStore(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/users'], {
      queryParams: {
        tenantId: store.tenantId,
        storeId: store.id,
        intent: 'create-user',
        suggestedRole: 'AdminStore',
      },
    });
  }

  private tenantId(): string | null {
    return this.route.snapshot.paramMap.get('tenantId');
  }

  private mapProblemDetails(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo completar la acción.';
    }

    const payload = error.error as
      | { detail?: string; title?: string; errors?: Record<string, string[] | undefined> }
      | null
      | undefined;

    if (payload?.detail) {
      return payload.detail;
    }

    const firstValidation = payload?.errors
      ? Object.values(payload.errors)
          .flat()
          .find((item): item is string => typeof item === 'string')
      : null;

    return firstValidation ?? payload?.title ?? 'No se pudo completar la acción.';
  }
}