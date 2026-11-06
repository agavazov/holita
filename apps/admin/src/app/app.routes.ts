import { computed, inject } from '@angular/core';
import {
  provideHttpClient,
  withInterceptors,
  withRequestsMadeViaParent,
} from '@angular/common/http';
import { Router, type Routes } from '@angular/router';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession } from './core/auth/demo-session';
import { sessionExpiryInterceptor } from './core/auth/session-expiry-interceptor';
import { BranchesApi } from './features/branches/branches-api';
import { ACCOUNT_MENU_CONTEXT } from './layout/account-menu-context';
import { leaveDrawer } from './ui/drawer/leave-drawer.guard';
import { fleetRoutes } from './features/fleet/fleet.routes';
import { controlCenterRoutes } from './features/control-center/control-center.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'bg' },
  {
    path: ':language/sign-in',
    canActivate: [
      (route) =>
        ['bg', 'en'].includes(String(route.paramMap.get('language'))) ||
        inject(Router).createUrlTree(['/bg/sign-in']),
    ],
    loadComponent: () => import('./features/auth/sign-in-page').then((module) => module.SignInPage),
  },
  {
    path: ':language',
    providers: [
      provideHttpClient(withInterceptors([sessionExpiryInterceptor]), withRequestsMadeViaParent()),
      HttpLink,
      BranchesApi,
      {
        provide: ACCOUNT_MENU_CONTEXT,
        useFactory: () => {
          const session = inject(DemoSession);
          return computed(() => {
            const user = session.user();
            return user ? { name: user.name, detail: user.email } : null;
          });
        },
      },
    ],
    canActivate: [
      (route) =>
        ['bg', 'en'].includes(String(route.paramMap.get('language'))) ||
        inject(Router).createUrlTree(['/bg']),
    ],
    loadComponent: () =>
      import('./workspace/admin-workspace').then((module) => module.AdminWorkspace),
    children: [
      {
        path: 'profile',
        data: { requiresBranch: false },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./features/profile/profile-page').then((module) => module.ProfilePage),
      },
      {
        path: 'settings/users',
        data: { requiresBranch: false },
        loadComponent: () =>
          import('./features/users/users-page').then((module) => module.UsersPage),
        children: [
          {
            path: 'new',
            data: { drawer: true, mode: 'create' },
            canDeactivate: [leaveDrawer],
            loadComponent: () =>
              import('./features/users/user-editor-page').then((module) => module.UserEditorPage),
          },
          {
            path: ':recordId/edit',
            data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
            canDeactivate: [leaveDrawer],
            loadComponent: () =>
              import('./features/users/user-editor-page').then((module) => module.UserEditorPage),
          },
        ],
      },
      ...controlCenterRoutes,
      ...fleetRoutes,
      { path: '**', redirectTo: '' },
    ],
  },
];
