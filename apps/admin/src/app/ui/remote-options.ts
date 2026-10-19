import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, switchMap, timer, type Observable } from 'rxjs';

interface OptionsRequest {
  readonly search: string;
  readonly ids: readonly string[] | null;
  readonly delay: number;
}

/**
 * Remote search for a `p-autocomplete` picker. The loader calls the feature's own API (its own
 * captured client); the latest request wins and obsolete results are ignored. Construct it in an
 * injection context; it stops with its owner.
 */
export class RemoteOptions<T extends { readonly id: string }> {
  readonly options = signal<readonly T[]>([]);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  private readonly requests = new Subject<OptionsRequest>();

  constructor(
    private readonly load: (
      search: string,
      ids: readonly string[] | null,
    ) => Observable<readonly T[]>,
  ) {
    this.requests
      .pipe(
        switchMap((request) =>
          timer(request.delay).pipe(
            switchMap(() => {
              this.loading.set(true);
              this.error.set(null);
              return this.load(request.search, request.ids).pipe(
                catchError((error: unknown) => {
                  this.error.set(error);
                  return EMPTY;
                }),
                finalize(() => {
                  this.loading.set(false);
                }),
              );
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((options) => {
        this.options.set(options);
      });
  }

  /** Searches after 250 ms of quiet input. */
  search(text: string): void {
    this.requests.next({ search: text.trim(), ids: null, delay: 250 });
  }

  /** Loads the selected records by ID (e.g. to label values from the URL or a record). */
  hydrate(ids: readonly string[]): void {
    if (ids.length) {
      this.requests.next({ search: '', ids, delay: 0 });
    }
  }
}
