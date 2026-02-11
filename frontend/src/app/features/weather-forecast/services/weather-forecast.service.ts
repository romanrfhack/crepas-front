import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/services/api-client';
import { WeatherForecast } from '../models/weather-forecast.model';

@Injectable({ providedIn: 'root' })
export class WeatherForecastService {
  private readonly apiClient = inject(ApiClient);

  getForecasts() {
    return this.apiClient.get<WeatherForecast[]>('/WeatherForecast');
  }
}
