import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { Color, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';

interface ChartBarData {
  name: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly document = inject(DOCUMENT);

  readonly monthlySalesData = signal<ChartBarData[]>([
    { name: 'Ene', value: 12000 },
    { name: 'Feb', value: 14250 },
    { name: 'Mar', value: 13500 },
    { name: 'Abr', value: 16800 },
    { name: 'May', value: 17420 },
    { name: 'Jun', value: 18610 },
  ]);

  readonly chartColorScheme = signal<Color>({
    name: 'brand-dashboard',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#e89aac', '#6b3f2a', '#f3b6c2', '#c98d6a', '#0f172a', '#475569'],
  });

  constructor() {
    afterNextRender(() => {
      this.chartColorScheme.set(this.buildColorSchemeFromCssVariables());
    });
  }

  private buildColorSchemeFromCssVariables(): Color {
    const computedStyle = getComputedStyle(this.document.documentElement);
    const resolveToken = (token: string, fallback: string) => {
      const value = computedStyle.getPropertyValue(token).trim();
      return value.length > 0 ? value : fallback;
    };

    return {
      name: 'brand-dashboard',
      selectable: true,
      group: ScaleType.Ordinal,
      domain: [
        resolveToken('--brand-rose-strong', '#e89aac'),
        resolveToken('--brand-cocoa', '#6b3f2a'),
        resolveToken('--brand-rose', '#f3b6c2'),
        '#c98d6a',
        resolveToken('--brand-ink', '#0f172a'),
        resolveToken('--brand-muted', '#475569'),
      ],
    };
  }
}
