import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlatformVerticalDto } from '../../models/platform.models';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';
import { VerticalsPage } from './verticals.page';

describe('VerticalsPage', () => {
  let fixture: ComponentFixture<VerticalsPage>;
  let rows: PlatformVerticalDto[];
  const createVertical = vi.fn();
  const updateVertical = vi.fn();
  const deleteVertical = vi.fn();

  beforeEach(async () => {
    rows = [{ id: 'v1', name: 'Retail', description: 'Shop', isActive: true, createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-02' }];

    await TestBed.configureTestingModule({
      imports: [VerticalsPage],
      providers: [
        {
          provide: PlatformVerticalsApiService,
          useValue: {
            listVerticals: async () => rows,
            createVertical,
            updateVertical,
            deleteVertical,
          },
        },
      ],
    }).compileComponents();

    createVertical.mockResolvedValue({});
    updateVertical.mockResolvedValue({});
    deleteVertical.mockResolvedValue({});

    fixture = TestBed.createComponent(VerticalsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders table and supports create/edit states', async () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="vertical-row-v1"]')).toBeTruthy();

    host.querySelector('[data-testid="vertical-create-open"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const nameInput = host.querySelector('[data-testid="vertical-form-name"]') as HTMLInputElement;
    nameInput.value = 'Food';
    nameInput.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    await fixture.whenStable();

    expect(createVertical).toHaveBeenCalled();
    expect(host.querySelector('[data-testid="platform-verticals-success"]')).toBeTruthy();

    host.querySelector('[data-testid="vertical-edit-v1"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    await fixture.whenStable();

    expect(updateVertical).toHaveBeenCalledWith('v1', { name: 'Retail', description: 'Shop' });
  });

  it('shows error state by testid', async () => {
    createVertical.mockRejectedValueOnce({ error: { detail: 'validation failed' } });
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector('[data-testid="vertical-create-open"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const input = host.querySelector('[data-testid="vertical-form-name"]') as HTMLInputElement;
    input.value = 'Bad';
    input.dispatchEvent(new Event('input'));

    const form = fixture.debugElement.query(By.css('form'));
    form.triggerEventHandler('submit', new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="platform-verticals-error"]')?.textContent).toContain('validation failed');
  });
});
