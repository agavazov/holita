import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { FleetRouteReuseStrategy } from './features/fleet/fleet-route-reuse';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { timeout } from 'rxjs';
import { routes } from './app.routes';
import { AdminErrorHandler } from './core/admin-error-handler';
import {
  ADMIN_RUNTIME_CONFIG,
  AdminConfig,
  type AdminRuntimeConfig,
} from './core/config/admin-config';
import { graphqlOptions } from './core/graphql/graphql-options';
import { provideOsnovaTheme, THEME_STORAGE_KEY } from '@osnova/ui/theme';
import { SHELL_STORAGE_KEY } from '@osnova/ui/layout';
import { appTheme, type ThemeChoice } from '@osnova/ui/theme';

/** The application providers. */
export function appConfig(
  config: AdminRuntimeConfig,
  theme: ThemeChoice = appTheme,
): ApplicationConfig {
  return {
    providers: [
      { provide: ADMIN_RUNTIME_CONFIG, useValue: config },
      { provide: THEME_STORAGE_KEY, useValue: 'discocan.admin.theme' },
      { provide: SHELL_STORAGE_KEY, useValue: 'discocan.admin.sidebar' },
      { provide: ErrorHandler, useClass: AdminErrorHandler },
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withInterceptors([(request, next) => next(request).pipe(timeout(10_000))])),
      provideOsnovaTheme(theme, config.primeUiLicense),
      provideApollo(() => graphqlOptions(inject(HttpLink), inject(AdminConfig).graphqlUrl)),
      provideRouter(routes),
      { provide: RouteReuseStrategy, useClass: FleetRouteReuseStrategy },
    ],
  };
}
