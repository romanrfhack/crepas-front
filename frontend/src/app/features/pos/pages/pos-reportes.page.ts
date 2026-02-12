import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DailySummaryDto, TopProductDto } from '../models/pos.models';
import { PosSalesApiService } from '../services/pos-sales-api.service';

@Component({
  selector: 'app-pos-reportes-page',
  imports: [FormsModule],
  template: `
    <section>
      <h1>Reportes POS</h1>
      <label>
        Fecha
        <input type="date" [(ngModel)]="date" />
      </label>
      <button type="button" (click)="loadReports()">Consultar</button>
      <button type="button" (click)="exportTopProductsCsv()" [disabled]="topProducts().length === 0">Exportar CSV</button>

      @if (summary(); as daily) {
        <p>Tickets: {{ daily.totalTickets }} | Total: {{ daily.totalAmount.toFixed(2) }} | Promedio: {{ daily.avgTicket.toFixed(2) }}</p>
      }

      <table>
        <thead>
          <tr><th>Producto</th><th>Cantidad</th><th>Monto</th></tr>
        </thead>
        <tbody>
          @for (item of topProducts(); track item.productId) {
            <tr>
              <td>{{ item.productNameSnapshot }}</td>
              <td>{{ item.qty }}</td>
              <td>{{ item.amount.toFixed(2) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosReportesPage {
  private readonly api = inject(PosSalesApiService);

  readonly date = new Date().toISOString().slice(0, 10);
  readonly summary = signal<DailySummaryDto | null>(null);
  readonly topProducts = signal<TopProductDto[]>([]);
  readonly csvContent = computed(() => {
    const header = 'producto,cantidad,monto';
    const rows = this.topProducts().map((item) => `${item.productNameSnapshot},${item.qty},${item.amount.toFixed(2)}`);
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
}
