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
import type { FleetDriverStatus } from '../../../../generated/graphql/operations';
import { VehiclesApi } from './vehicles-api';
import type { VehicleOption } from './vehicles-view';

export interface VehicleDriverOption extends VehicleOption {
  readonly status: FleetDriverStatus;
}

/** Complete, scoped choices; each request page is bounded and all reads retire with the host. */
@Injectable()
export class VehicleChoices {
  private readonly api = inject(VehiclesApi);
  private readonly requests = new Subject<void>();
  readonly groups = signal<readonly VehicleOption[]>([]);
  readonly drivers = signal<readonly VehicleDriverOption[]>([]);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);

  constructor() {
    const groups = (offset: number) =>
      this.api.watchGroups({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing vehicle groups.');
          }
          return result.data.fleetVehicleGroups;
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
            throw new Error('Missing vehicle drivers.');
          }
          return result.data.fleetDrivers;
        }),
      );
    this.requests
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return forkJoin({
            groups: groups(0).pipe(
              expand((page) =>
                page.offset + page.items.length < page.total && page.items.length
                  ? groups(page.offset + page.items.length)
                  : EMPTY,
              ),
              reduce(
                (all: VehicleOption[], page) => [
                  ...all,
                  ...page.items.map((group) => ({ id: group.id, name: group.name })),
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
                (all: VehicleDriverOption[], page) => [
                  ...all,
                  ...page.items.map((driver) => ({
                    id: driver.id,
                    name: `${driver.firstName} ${driver.lastName}`,
                    status: driver.status,
                  })),
                ],
                [],
              ),
            ),
          }).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((choices) => {
        this.groups.set(choices.groups);
        this.drivers.set(choices.drivers);
        this.loading.set(false);
      });
  }

  load(): void {
    this.requests.next();
  }
}
