import { PosTimezoneService } from './pos-timezone.service';

describe('PosTimezoneService', () => {
  it('returns a consistent CDMX local date instead of UTC day crossover', () => {
    const service = new PosTimezoneService();

    const utcInstant = new Date('2026-03-01T00:30:00.000Z');
    const isoDate = service.getIsoDateInBusinessTimezone(utcInstant);

    expect(isoDate).toBe('2026-02-28');
  });

  it('todayIsoDate returns YYYY-MM-DD format based on business timezone', () => {
    const service = new PosTimezoneService();

    const today = service.todayIsoDate();

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
