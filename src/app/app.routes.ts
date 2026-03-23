import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { anonymousGuard } from './core/guards/anonymous.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    canActivate: [anonymousGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
    canActivate: [anonymousGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'boards' },
      {
        path: 'boards',
        loadComponent: () =>
          import('./features/board/board-list.component').then((m) => m.BoardListComponent),
      },
      {
        path: 'boards/:boardId',
        loadComponent: () =>
          import('./features/board/board.component').then((m) => m.BoardComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'boards' },
];
