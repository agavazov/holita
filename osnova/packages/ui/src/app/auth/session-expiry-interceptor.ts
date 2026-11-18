import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { DemoSession } from './demo-session';

function unauthenticated(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'errors' in body &&
    Array.isArray(body.errors) &&
    body.errors.some(
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'extensions' in error &&
        typeof error.extensions === 'object' &&
        error.extensions !== null &&
        'code' in error.extensions &&
        error.extensions.code === 'UNAUTHENTICATED',
    )
  );
}

/** Retires only the session captured by a request rejected by the server. */
export const sessionExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(DemoSession);
  const token = session.current()?.token;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return next(request);
  }
  const expire = () => {
    if (session.current()?.token === token) {
      session.expire(token);
    }
  };
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse && unauthenticated(event.body)) {
          expire();
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          expire();
        }
      },
    }),
  );
};
