import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, expand, filter, map, reduce, switchMap, take } from 'rxjs';
import { AlertsApi } from './alerts-api';
import type { AlertOption } from './alerts-view';

@Injectable()
export class AlertChoices {
  private readonly api = inject(AlertsApi);
  private readonly reload = new Subject<void>();
  readonly vehicles = signal<readonly AlertOption[]>([]);
  readonly error = signal<unknown>(null);
  constructor() {
    const pageAt = (offset: number) =>
      this.api.watchVehicles({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing alert vehicle choices.');
          }
          return result.data.fleetVehicles;
        }),
      );
    this.reload
      .pipe(
        switchMap(() => {
          this.error.set(null);
          return pageAt(0).pipe(
            expand((page) =>
              page.offset + page.items.length < page.total && page.items.length
                ? pageAt(page.offset + page.items.length)
                : EMPTY,
            ),
            reduce(
              (all: AlertOption[], page) => [
                ...all,
                ...page.items.map((vehicle) => ({ id: vehicle.id, name: vehicle.licensePlate })),
              ],
              [],
            ),
            catchError((error: unknown) => {
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((vehicles) => {
        this.vehicles.set(vehicles);
      });
  }
  load(): void {
    this.reload.next();
  }
}
