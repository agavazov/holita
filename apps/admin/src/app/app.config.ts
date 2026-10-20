import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { FleetRouteReuseStrategy } from './features/fleet/fleet-route-reuse';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { timeout } from 'rxjs';
import { routes } from './app.routes';
import {
  ADMIN_RUNTIME_CONFIG,
  AdminConfig,
  type AdminRuntimeConfig,
} from './core/config/admin-config';
import { graphqlOptions } from './core/graphql/graphql-options';
import { provideHolitaTheme } from './theme/provide-holita-theme';
import { appTheme, type ThemeChoice } from './theme/theme-choice';

/** The application providers; `theme` is `appTheme` except in Storybook's brand/density review. */
export function appConfig(
  config: AdminRuntimeConfig,
  theme: ThemeChoice = appTheme,
): ApplicationConfig {
  return {
    providers: [
      { provide: ADMIN_RUNTIME_CONFIG, useValue: config },
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withInterceptors([(request, next) => next(request).pipe(timeout(10_000))])),
      provideHolitaTheme(theme, config.primeUiLicense),
      provideApollo(() => graphqlOptions(inject(HttpLink), inject(AdminConfig).graphqlUrl)),
      provideRouter(routes),
      { provide: RouteReuseStrategy, useClass: FleetRouteReuseStrategy },
    ],
  };
}
