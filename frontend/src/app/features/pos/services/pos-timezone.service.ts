import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PosTimezoneService {
  private readonly timeZone = 'America/Mexico_City';
  private readonly shortDateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: this.timeZone,
  });
  private readonly dayPartsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: this.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  formatDateTime(value: string): string {
    return this.shortDateTimeFormatter.format(new Date(value));
  }

  todayIsoDate(): string {
    return this.getIsoDateInBusinessTimezone(new Date());
  }

  getIsoDateInBusinessTimezone(value: Date): string {
    const parts = this.dayPartsFormatter.formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }
}
