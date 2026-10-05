import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { timeout } from 'rxjs';
import { routes } from './app.routes';
import { AdminConfig } from './core/config/admin-config';
import { graphqlOptions } from './core/graphql/graphql-options';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([(request, next) => next(request).pipe(timeout(10_000))])),
    provideAppInitializer(() => inject(AdminConfig).load()),
    provideApollo(() => graphqlOptions(inject(HttpLink), inject(AdminConfig).graphqlUrl)),
    provideRouter(routes),
  ],
};
