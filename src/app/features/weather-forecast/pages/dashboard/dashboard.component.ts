import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { WeatherForecastService } from '../../services/weather-forecast.service';
import { WeatherForecast } from '../../models/weather-forecast.model';

@Component({
  selector: 'app-dashboard',
  template: `
    <section class="dashboard">
      <header class="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Pronóstico obtenido desde el endpoint protegido.</p>
        </div>
        <button type="button" class="ghost-button" (click)="loadForecasts()" [disabled]="loading()">
          Actualizar
        </button>
      </header>

      @if (loading()) {
        <p class="status">Cargando pronóstico...</p>
      } @else if (errorMessage()) {
        <p class="status error" role="alert">{{ errorMessage() }}</p>
      } @else if (hasForecasts()) {
        <div class="forecast-grid" role="list">
          @for (forecast of forecasts(); track forecast.date) {
            <article class="forecast-card" role="listitem">
              <h2 class="forecast-title">{{ forecast.summary }}</h2>
              <p class="forecast-date">{{ forecast.date }}</p>
              <div class="forecast-temps">
                <span class="temp-label">°C</span>
                <span class="temp-value">{{ forecast.temperatureC }}</span>
                <span class="temp-label">°F</span>
                <span class="temp-value">{{ forecast.temperatureF }}</span>
              </div>
            </article>
          }
        </div>
      } @else {
        <p class="status">No hay datos disponibles.</p>
      }
    </section>
  `,
  styles: `
    .dashboard {
      width: min(960px, 100%);
      display: grid;
      gap: 1.5rem;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    h1 {
      margin: 0;
      font-size: 1.75rem;
    }
    .status {
      margin: 0;
      padding: 1rem;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .status.error {
      color: #b42318;
      background: #fff1f0;
      border-color: #fecaca;
    }
    .forecast-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .forecast-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 1.25rem;
      border: 1px solid #e2e8f0;
      display: grid;
      gap: 0.5rem;
    }
    .forecast-title {
      margin: 0;
      font-size: 1.1rem;
      color: #0f172a;
    }
    .forecast-date {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .forecast-temps {
      display: grid;
      grid-template-columns: auto 1fr auto 1fr;
      gap: 0.5rem;
      align-items: center;
      font-weight: 600;
      color: #1d4ed8;
    }
    .temp-label {
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .ghost-button {
      background: transparent;
      border: 1px solid #cbd5f5;
      border-radius: 999px;
      padding: 0.5rem 1rem;
      color: #1d4ed8;
      font-weight: 600;
      cursor: pointer;
    }
    .ghost-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .ghost-button:focus-visible {
      outline: 3px solid #94a3ff;
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly weatherService = inject(WeatherForecastService);
  readonly forecasts = signal<WeatherForecast[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly hasForecasts = computed(() => this.forecasts().length > 0);

  ngOnInit() {
    this.loadForecasts();
  }

  loadForecasts() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.weatherService
      .getForecasts()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.forecasts.set(data ?? []),
        error: () => {
          this.errorMessage.set('No pudimos cargar el pronóstico. Revisa la consola.');
        },
      });
  }
}
