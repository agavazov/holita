import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, expand, filter, map, reduce, switchMap, take } from 'rxjs';
import { DevicesApi } from './devices-api';

/** Complete Vehicle choices through bounded pages in the editor's captured workspace. */
@Injectable()
export class DeviceChoices {
  private readonly api = inject(DevicesApi);
  private readonly requests = new Subject<void>();
  readonly vehicles = signal<readonly { id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  constructor() {
    const page = (offset: number) =>
      this.api.watchVehicles({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing Device Vehicle choices.');
          }
          return result.data.fleetVehicles;
        }),
      );
    this.requests
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return page(0).pipe(
            expand((result) =>
              result.offset + result.items.length < result.total && result.items.length
                ? page(result.offset + result.items.length)
                : EMPTY,
            ),
            reduce(
              (all: { id: string; name: string }[], result) => [
                ...all,
                ...result.items.map((vehicle) => ({ id: vehicle.id, name: vehicle.licensePlate })),
              ],
              [],
            ),
            catchError((error: unknown) => {
              this.error.set(error);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((vehicles) => {
        this.vehicles.set(vehicles);
        this.loading.set(false);
      });
  }
  load(): void {
    this.requests.next();
  }
}
