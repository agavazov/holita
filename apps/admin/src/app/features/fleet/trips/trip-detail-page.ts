import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminTripDetailsFragment } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { tripsText } from './i18n/messages';
import { TripDrawer } from './trip-drawer';
import { tripRow } from './trip-mapping';
import { TripsApi } from './trips-api';
@Component({
  selector: 'holita-trip-detail-page',
  imports: [TripDrawer],
  providers: [TripsApi],
  template:
    '<holita-trip-drawer [trip]="trip()" [state]="state()" [loadError]="failure()" [closeLink]="listLink" (retry)="retry.next()" (openVehicle)="openVehicle($event)" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailPage implements OnInit {
  private readonly api = inject(TripsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(UI_LANGUAGE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  readonly id = drawerParam(this.route, 'recordId');
  readonly listLink = this.host.closeLink ?? [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'trips',
  ];
  readonly record = signal<AdminTripDetailsFragment | null>(null);
  readonly state = signal<RouteDrawerState>('loading');
  readonly error = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  readonly trip = computed(() => {
    const record = this.record();
    return record ? tripRow(record, this.language()) : null;
  });
  readonly failure = computed(() =>
    requestError(this.error(), tripsText(this.language()).table.errorText),
  );
  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Trip drawer needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.error.set(null);
          return this.api.watchTrip(id).valueChanges.pipe(
            catchError((error: unknown) => {
              this.failRead(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failRead(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          if (this.host.vehicleId && result.data.fleetTrip.vehicleId !== this.host.vehicleId) {
            this.state.set('not-found');
            return;
          }
          this.record.set(result.data.fleetTrip);
          this.state.set('ready');
        }
      });
  }
  private failRead(error: unknown): void {
    this.error.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
  openVehicle(vehicleId: string): void {
    if (this.host.closeLink && this.host.vehicleId === vehicleId) {
      void this.router.navigate(this.host.closeLink, {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
      return;
    }
    void this.router.navigate([
      '/',
      this.language(),
      drawerParam(this.route, 'branchId'),
      'fleet',
      'vehicles',
      vehicleId,
      'overview',
    ]);
  }
  canLeave(): boolean {
    return true;
  }
}
