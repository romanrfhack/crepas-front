import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#128202; Dashboard</h2>
        <p class="page-subtitle">Bienvenido al panel de control</p>
        <div class="header-decoration"></div>
      </header>

      <!-- SECCIÓN: PRÓXIMAMENTE / EN CONSTRUCCIÓN -->
      <div class="section-card coming-soon-card">
        <div class="coming-soon-content">
          <span class="coming-soon-icon">🚧</span>
          <h3>Próximamente</h3>
          <p class="coming-soon-text">
            Estamos trabajando para traerte un dashboard completo con métricas en tiempo real,
            gráficos de ventas, rendimiento de cajeros y más.
          </p>
          <div class="coming-soon-badge">
            <span class="badge-icon">⏳</span>
            <span>Disponible en futura versión</span>
          </div>
        </div>
      </div>

      <!-- DEMO DE KPIS - VALORES DE EJEMPLO -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📊</span>
          <h3>Métricas de demostración</h3>
          <span class="count-badge">demo</span>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-content">
              <span class="kpi-label">Ventas totales (hoy)</span>
              <span class="kpi-value">$ 12,450.00</span>
              <span class="kpi-trend positive">+15% vs ayer</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">🧾</div>
            <div class="kpi-content">
              <span class="kpi-label">Tickets</span>
              <span class="kpi-value">86</span>
              <span class="kpi-trend positive">+8% vs ayer</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📈</div>
            <div class="kpi-content">
              <span class="kpi-label">Ticket promedio</span>
              <span class="kpi-value">$ 144.77</span>
              <span class="kpi-trend negative">-3% vs ayer</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">👥</div>
            <div class="kpi-content">
              <span class="kpi-label">Clientes atendidos</span>
              <span class="kpi-value">72</span>
              <span class="kpi-trend positive">+12% vs ayer</span>
            </div>
          </div>
        </div>
        <div class="demo-hint">
          <span class="hint-icon">🔵</span>
          <span>Valores ilustrativos con fines de demostración</span>
        </div>
      </div>

      <!-- GRÁFICO DE DEMO - PLACEHOLDER -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📉</span>
          <h3>Ventas por hora (demo)</h3>
        </div>
        <div class="chart-placeholder">
          <div class="chart-bars">
            <div class="chart-bar" style="height: 40px;"></div>
            <div class="chart-bar" style="height: 65px;"></div>
            <div class="chart-bar" style="height: 55px;"></div>
            <div class="chart-bar" style="height: 80px;"></div>
            <div class="chart-bar" style="height: 70px;"></div>
            <div class="chart-bar" style="height: 95px;"></div>
            <div class="chart-bar" style="height: 60px;"></div>
            <div class="chart-bar" style="height: 45px;"></div>
          </div>
          <div class="chart-labels">
            <span>8am</span><span>10am</span><span>12pm</span><span>2pm</span><span>4pm</span><span>6pm</span><span>8pm</span><span>10pm</span>
          </div>
          <div class="chart-overlay">
            <span class="overlay-icon">📊</span>
            <span>Gráfico interactivo próximamente</span>
          </div>
        </div>
      </div>

      <!-- ACCIONES RÁPIDAS (DEMO) -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">⚡</span>
          <h3>Acciones rápidas</h3>
        </div>
        <div class="quick-actions">
          <button type="button" class="btn-outline" disabled>
            🛒 Ver ventas del día
          </button>
          <button type="button" class="btn-outline" disabled>
            📊 Reporte semanal
          </button>
          <button type="button" class="btn-outline" disabled>
            🔔 Configurar alertas
          </button>
          <button type="button" class="btn-outline" disabled>
            👤 Administrar usuarios
          </button>
        </div>
        <div class="demo-hint">
          <span class="hint-icon">🔵</span>
          <span>Opciones deshabilitadas en la versión demo</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* Variables de diseño - mismas que en el POS y Admin */
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

    .dashboard-page {
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
      font-size: 1.5rem;
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

    /* ===== TARJETAS DE SECCIÓN ===== */
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
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* ===== TARJETA DE PRÓXIMAMENTE ===== */
    .coming-soon-card {
      background: linear-gradient(145deg, #fff8f5, #fff0ed);
      border-color: rgba(232, 154, 172, 0.3);
    }

    .coming-soon-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1rem 0.5rem;
    }

    .coming-soon-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    .coming-soon-content h3 {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      margin: 0 0 0.5rem 0;
    }

    .coming-soon-text {
      max-width: 600px;
      margin: 0 0 1.25rem 0;
      color: var(--brand-muted);
      font-size: 1rem;
      line-height: 1.5;
    }

    .coming-soon-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--brand-ink);
      font-weight: 600;
      font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .badge-icon {
      font-size: 1.1rem;
    }

    /* ===== GRID DE KPIS ===== */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      transition: all var(--transition);
    }

    .kpi-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-sm);
      transform: translateY(-2px);
    }

    .kpi-icon {
      font-size: 2rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--brand-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .kpi-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-ink);
      line-height: 1.2;
    }

    .kpi-trend {
      font-size: 0.7rem;
      font-weight: 600;
      margin-top: 0.15rem;
    }

    .kpi-trend.positive {
      color: #10b981;
    }

    .kpi-trend.negative {
      color: #b42318;
    }

    /* ===== DEMO HINT ===== */
    .demo-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.12);
      padding: 0.5rem 1rem;
      border-radius: 999px;
      width: fit-content;
    }

    .hint-icon {
      font-size: 0.9rem;
    }

    /* ===== PLACEHOLDER DE GRÁFICO ===== */
    .chart-placeholder {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem 1rem 1rem;
      background: rgba(243, 182, 194, 0.04);
      border-radius: var(--radius-md);
      min-height: 180px;
      justify-content: flex-end;
    }

    .chart-bars {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      gap: 0.5rem;
      width: 100%;
    }

    .chart-bar {
      width: 100%;
      max-width: 50px;
      background: linear-gradient(to top, var(--brand-rose-strong), #c98d6a);
      border-radius: 12px 12px 6px 6px;
      opacity: 0.7;
      transition: height var(--transition);
    }

    .chart-labels {
      display: flex;
      justify-content: space-around;
      font-size: 0.7rem;
      color: var(--brand-muted);
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .chart-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(4px);
      border-radius: var(--radius-md);
      color: var(--brand-ink);
      font-weight: 600;
      gap: 0.5rem;
    }

    .overlay-icon {
      font-size: 2rem;
      opacity: 0.8;
    }

    /* ===== ACCIONES RÁPIDAS ===== */
    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    /* ===== BOTONES ===== */
    .btn-outline {
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.65rem 1.4rem;
      font-weight: 600;
      font-size: 0.9rem;
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
      background: #f9fafb;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .kpi-grid {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        padding: 0.9rem;
      }

      .kpi-value {
        font-size: 1.3rem;
      }

      .quick-actions {
        flex-direction: column;
      }

      .btn-outline {
        width: 100%;
      }

      .chart-bars {
        gap: 0.25rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  // Componente completamente demo, sin lógica real
  // Todos los valores son ilustrativos y estáticos
}