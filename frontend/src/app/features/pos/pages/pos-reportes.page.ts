import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DailySummaryDto, TopProductDto } from '../models/pos.models';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { CommonModule } from '@angular/common';
import { PosTimezoneService } from '../services/pos-timezone.service';

@Component({
  selector: 'app-pos-reportes-page',
  imports: [FormsModule, CommonModule],
  template: `
    <div class="reportes-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#128200; Reportes POS</h2>
        <p class="page-subtitle">Consulta de ventas diarias y productos más vendidos</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE CONTROLES -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">&#128197;</span>
          <h3>Parámetros de consulta</h3>
        </div>

        <div class="filters-grid">
          <div class="form-field">
            <label for="report-date">Fecha</label>
            <input
              id="report-date"
              type="date"
              [(ngModel)]="date"
              class="form-input"
            />
          </div>
          <div class="form-actions">
            <button
              type="button"
              class="btn-primary"
              (click)="loadReports()"
            >
              &#128269; Consultar
            </button>
            <button
              type="button"
              class="btn-outline"
              [disabled]="topProducts().length === 0"
              (click)="exportTopProductsCsv()"
            >
              &#128190; Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <!-- TARJETA DE RESUMEN DIARIO -->
      @if (summary(); as daily) {
        <div class="section-card summary-card">
          <div class="section-header">
            <span class="section-icon">&#128202;</span>
            <h3>Resumen del {{ formatDate(date) }}</h3>
          </div>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Tickets</span>
              <span class="stat-value">{{ daily.totalTickets }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total</span>
              <span class="stat-value">$ {{ daily.totalAmount.toFixed(2) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Ticket promedio</span>
              <span class="stat-value">$ {{ daily.avgTicket.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      } @else {
        <div class="empty-state" *ngIf="!summary() && topProducts().length === 0">
          <span class="empty-icon">&#128200;</span>
          <p>Selecciona una fecha y presiona "Consultar"</p>
        </div>
      }

      <!-- TABLA DE PRODUCTOS MÁS VENDIDOS -->
      @if (topProducts().length > 0) {
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">&#128221;</span>
            <h3>Productos más vendidos</h3>
            <span class="count-badge">
              {{ topProducts().length }} productos
            </span>
          </div>

          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th class="text-right">Cantidad</th>
                  <th class="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                @for (item of topProducts(); track item.productId) {
                  <tr>
                    <td>{{ item.productNameSnapshot }}</td>
                    <td class="text-right">{{ item.qty }}</td>
                    <td class="text-right">$ {{ item.amount.toFixed(2) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        @if (summary() && topProducts().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">&#128230;</span>
            <p>No hay productos vendidos en esta fecha</p>
          </div>
        }
      }
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

    .reportes-page {
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
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== FILTROS ===== */
    .filters-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1.5rem;
      align-items: flex-end;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--brand-ink);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .form-input {
      width: 100%;
      padding: 0.65rem 1rem;
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

    .form-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    /* ===== BOTONES ===== */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border: none;
      border-radius: 999px;
      padding: 0.65rem 1.6rem;
      font-weight: 700;
      font-size: 0.9rem;
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
    }

    /* ===== ESTADÍSTICAS ===== */
    .summary-card {
      background: linear-gradient(145deg, #ffffff, #faf9f8);
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      background: rgba(243, 182, 194, 0.08);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }

    .stat-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      line-height: 1.2;
      margin-top: 0.25rem;
    }

    /* ===== TABLA MODERNA ===== */
    .table-responsive {
      overflow-x: auto;
      border-radius: var(--radius-md);
    }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }

    .modern-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      background: rgba(243, 182, 194, 0.12);
      color: var(--brand-cocoa);
      font-weight: 700;
      border-bottom: 2px solid var(--border);
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

    .text-right {
      text-align: right;
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
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
      opacity: 0.7;
    }

    .empty-state p {
      margin: 0;
      font-weight: 500;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .filters-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .form-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .summary-stats {
        grid-template-columns: 1fr;
      }

      .form-actions {
        flex-direction: column;
        width: 100%;
      }

      .btn-primary,
      .btn-outline {
        width: 100%;
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
export class PosReportesPage {
  private readonly api = inject(PosSalesApiService);
  private readonly timezone = inject(PosTimezoneService);

  date = this.timezone.todayIsoDate();
  readonly summary = signal<DailySummaryDto | null>(null);
  readonly topProducts = signal<TopProductDto[]>([]);
  readonly csvContent = computed(() => {
    const header = 'producto,cantidad,monto';
    const rows = this.topProducts().map((item) =>
      `${item.productNameSnapshot},${item.qty},${item.amount.toFixed(2)}`
    );
    return [header, ...rows].join('\n');
  });

  async loadReports() {
    const [summary, topProducts] = await Promise.all([
      this.api.getDailySummary(this.date),
      this.api.getTopProducts(this.date, this.date, 20),
    ]);

    this.summary.set(summary);
    this.topProducts.set(topProducts);
  }

  exportTopProductsCsv() {
    const blob = new Blob([this.csvContent()], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pos-top-products-${this.date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }
}
