import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_NAV_CONFIG } from '../../navigation/app-nav.config';
import { AppNavComponent } from './app-nav.component';

describe('AppNavComponent', () => {
  it('should hide restricted links when there are no assigned roles', async () => {
    await TestBed.configureTestingModule({
      imports: [AppNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppNavComponent);
    fixture.componentRef.setInput('navItems', APP_NAV_CONFIG);
    fixture.componentRef.setInput('userRoles', []);
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')).map((link) =>
      ((link as HTMLAnchorElement).textContent ?? '').trim(),
    );

    expect(links).not.toContain('Dashboard');
    expect(links).not.toContain('Users');
    expect(fixture.nativeElement.textContent).not.toContain('Admin');
  });

  it('should render admin and pos catalog links for admin users', async () => {
    await TestBed.configureTestingModule({
      imports: [AppNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppNavComponent);
    fixture.componentRef.setInput('navItems', APP_NAV_CONFIG);
    fixture.componentRef.setInput('userRoles', ['AdminStore']);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Admin');
    expect(content).toContain('POS Catálogo');
    expect(content).toContain('Categories');
    expect(content).toContain('Overrides');
    expect(content).toContain('Caja POS');
  });

  it('should render Caja POS for cashier users', async () => {
    await TestBed.configureTestingModule({
      imports: [AppNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppNavComponent);
    fixture.componentRef.setInput('navItems', APP_NAV_CONFIG);
    fixture.componentRef.setInput('userRoles', ['Cashier']);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Caja POS');
    expect(content).not.toContain('Users');
  });
});
