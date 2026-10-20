import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  expand,
  filter,
  forkJoin,
  map,
  reduce,
  switchMap,
  take,
} from 'rxjs';
import { TripsApi } from './trips-api';
import type { TripOption } from './trips-view';
@Injectable()
export class TripChoices {
  private readonly api = inject(TripsApi);
  private readonly reload = new Subject<void>();
  readonly vehicles = signal<readonly TripOption[]>([]);
  readonly drivers = signal<readonly TripOption[]>([]);
  readonly error = signal<unknown>(null);
  constructor() {
    const vehicles = (offset: number) =>
      this.api.watchVehicles({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing trip vehicle choices.');
          }
          return result.data.fleetVehicles;
        }),
      );
    const drivers = (offset: number) =>
      this.api.watchDrivers({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing trip driver choices.');
          }
          return result.data.fleetDrivers;
        }),
      );
    this.reload
      .pipe(
        switchMap(() => {
          this.error.set(null);
          return forkJoin({
            vehicles: vehicles(0).pipe(
              expand((page) =>
                page.offset + page.items.length < page.total && page.items.length
                  ? vehicles(page.offset + page.items.length)
                  : EMPTY,
              ),
              reduce(
                (all: TripOption[], page) => [
                  ...all,
                  ...page.items.map((vehicle) => ({ id: vehicle.id, name: vehicle.licensePlate })),
                ],
                [],
              ),
            ),
            drivers: drivers(0).pipe(
              expand((page) =>
                page.offset + page.items.length < page.total && page.items.length
                  ? drivers(page.offset + page.items.length)
                  : EMPTY,
              ),
              reduce(
                (all: TripOption[], page) => [
                  ...all,
                  ...page.items.map((driver) => ({
                    id: driver.id,
                    name: `${driver.firstName} ${driver.lastName}`,
                  })),
                ],
                [],
              ),
            ),
          }).pipe(
            catchError((error: unknown) => {
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((choices) => {
        this.vehicles.set(choices.vehicles);
        this.drivers.set(choices.drivers);
      });
  }
  load(): void {
    this.reload.next();
  }
}
