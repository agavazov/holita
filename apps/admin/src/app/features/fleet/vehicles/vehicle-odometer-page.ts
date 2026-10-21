import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminVehicleOdometerQuery } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { vehiclesText } from './i18n/messages';
import { OdometerDrawer, type OdometerReading } from './odometer-drawer';
import { VehicleProfileApi } from './vehicle-profile-api';
import {
  odometerFieldErrors,
  odometerLatestAllowed,
  previousOdometer,
} from './vehicle-profile-mapping';

@Component({
  selector: 'holita-vehicle-odometer-page',
  imports: [OdometerDrawer],
  providers: [VehicleProfileApi],
  template: `
    <holita-odometer-drawer
      [plate]="record()?.fleetVehicle.licensePlate ?? '…'"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="closeLink"
      [previous]="previous()"
      [latestAllowedAt]="latestAllowedAt()"
      [saving]="saving()"
      [saveError]="saveFailure()"
      [fieldErrors]="fieldErrors()"
      (save)="save($event)"
      (retry)="retry.next()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleOdometerPage implements OnInit {
  private readonly api = inject(VehicleProfileApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(UI_LANGUAGE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(OdometerDrawer);
  private closingAfterSave = false;
  private readonly id = drawerParam(this.route, 'recordId');
  readonly closeLink = this.host.closeLink ?? [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId') ?? '',
    'fleet',
    'vehicles',
    this.id ?? '',
    drawerParam(this.route, 'tab') ?? 'overview',
  ];
  readonly state = signal<RouteDrawerState>('loading');
  readonly record = signal<AdminVehicleOdometerQuery | null>(null);
  readonly latestAllowedAt = signal(new Date().toISOString());
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  protected readonly previous = computed(() => {
    const record = this.record();
    return record ? previousOdometer(record.fleetVehicle) : null;
  });
  private readonly text = computed(() => vehiclesText(this.language()));
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().profile.errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? requestError(this.saveError(), this.text().odometer.saveError) : null,
  );
  protected readonly fieldErrors = computed(() => odometerFieldErrors(this.saveError(), this.language()));

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('An odometer drawer needs a Branch.');
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
          this.loadError.set(null);
          return this.api.watchOdometer(id).valueChanges.pipe(
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
          // Hydrate only once per drawer. A cache broadcast must never replace a dirty reading.
          if (this.record() === null) {
            this.record.set(result.data);
            this.latestAllowedAt.set(
              odometerLatestAllowed(result.data.fleetDataClock.asOf, Date.now()),
            );
          }
          this.state.set('ready');
        }
      });
  }

  async save(reading: OdometerReading): Promise<void> {
    if (this.saving() || this.state() !== 'ready' || !this.id) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const result = await this.api.recordOdometer({ vehicleId: this.id, ...reading });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.drawer()?.markSaved();
      this.saving.set(false);
      this.closingAfterSave = true;
      this.host.saved({ recordId: result.vehicleId, message: this.text().odometer.saved });
      await this.router.navigate(this.closeLink, {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.saveError.set(error);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.saving.set(false);
        this.closingAfterSave = false;
      }
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (this.drawer()?.canLeave() ?? true);
  }

  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
}
