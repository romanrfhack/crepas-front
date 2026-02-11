import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'app',
    canMatch: [authGuard],
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/app-shell/app-shell.routes').then((m) => m.appShellRoutes),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
