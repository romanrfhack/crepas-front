import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { posCatalogRoutes } from './pos-catalog.routes';
import { PosCatalogShellComponent } from './components/catalog-shell/catalog-shell.component';

describe('posCatalogRoutes', () => {
  it('should configure shell and categories as default entry', async () => {
    expect(posCatalogRoutes[0]?.component).toBe(PosCatalogShellComponent);

    const categoriesRoute = posCatalogRoutes[0]?.children?.find((route) => route.path === 'categories');
    expect(categoriesRoute?.loadComponent).toBeDefined();

    const loadedComponent = await categoriesRoute?.loadComponent?.();
    expect(loadedComponent).toBeDefined();
  });

  it('should create shell component', async () => {
    await TestBed.configureTestingModule({
      imports: [PosCatalogShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(PosCatalogShellComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
