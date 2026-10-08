import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { timeout } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import {
  ADMIN_RUNTIME_CONFIG,
  AdminConfig,
  type AdminRuntimeConfig,
} from './core/config/admin-config';
import { graphqlOptions } from './core/graphql/graphql-options';
import { PROTOTYPE_RESET } from './core/config/prototype-reset';
import { sakaiPreset } from './layout/sakai-preset';

export function appConfig(
  config: AdminRuntimeConfig,
  reset: (() => void | Promise<void>) | null = null,
): ApplicationConfig {
  return {
    providers: [
      { provide: ADMIN_RUNTIME_CONFIG, useValue: config },
      { provide: PROTOTYPE_RESET, useValue: reset },
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withInterceptors([(request, next) => next(request).pipe(timeout(10_000))])),
      providePrimeNG({
        ...(config.primeUiLicense ? { license: config.primeUiLicense } : {}),
        theme: { preset: sakaiPreset, options: { darkModeSelector: '.app-dark' } },
      }),
      provideApollo(() => graphqlOptions(inject(HttpLink), inject(AdminConfig).graphqlUrl)),
      provideRouter(routes),
    ],
  };
}
