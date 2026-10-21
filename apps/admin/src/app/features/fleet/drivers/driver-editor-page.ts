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
import { Subject, catchError, EMPTY, startWith, switchMap } from 'rxjs';
import { requestError } from '../../../core/graphql/request-error';
import { drawerParam, drawerRouteData } from '../../../ui/drawer/drawer-route';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DriverDrawer, type DriverDetails, type DriverForm } from './driver-drawer';
import { driverDetails, driverFieldErrors, driverInput } from './driver-mapping';
import { DriversApi } from './drivers-api';
import { driversText } from './i18n/messages';
import { fleetRecordLinks, type FleetRecordLinks } from '../fleet-record-links';

@Component({
  selector: 'holita-driver-editor-page',
  imports: [DriverDrawer],
  providers: [DriversApi],
  template: `
    <holita-driver-drawer
      [recordLinks]="recordLinks"
      [driver]="driver()"
      [startEditing]="editing"
      [businessDate]="businessDate()"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="listLink"
      [routed]="true"
      [saving]="saving()"
      [saveError]="saveFailure()"
      [fieldErrors]="fieldErrors()"
      (save)="save($event)"
      (retry)="retry.next()"
      (editRequest)="edit()"
      (cancelEdit)="viewRecord()"
      (openScorecard)="openScorecard()"
      (openVehicle)="openVehicle($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverEditorPage implements OnInit {
  private readonly api = inject(DriversApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(DriverDrawer);
  private closingAfterSave = false;
  private readonly routeData = drawerRouteData(this.route);
  readonly id = this.routeData.mode === 'create' ? null : drawerParam(this.route, 'recordId');
  readonly editing = this.routeData.mode !== 'view';
  readonly businessDate = signal<string | null>(null);
  readonly listLink = [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'drivers',
  ];
  readonly driver = signal<DriverDetails | null>(null);
  private readonly baseLinks = fleetRecordLinks(
    this.language(),
    drawerParam(this.route, 'branchId') ?? '',
  );
  protected readonly recordLinks: FleetRecordLinks = {
    ...this.baseLinks,
    vehicle: (vehicleId) => ({
      ...this.baseLinks.vehicle(vehicleId),
      ...(this.id ? { queryParams: { fromDriver: this.id } } : {}),
    }),
  };
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => driversText(this.language()));
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().table.errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? requestError(this.saveError(), this.text().drawer.saveError) : null,
  );
  protected readonly fieldErrors = computed(() =>
    driverFieldErrors(this.saveError(), this.language()),
  );

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Drivers drawer needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (this.id === null && this.routeData.mode === 'create') {
      this.loadCreateContext();
      return;
    }
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
          return this.api.watchDriver(id).valueChanges.pipe(
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
          this.businessDate.set(result.data.fleetDataClock.businessDate);
          if (this.state() !== 'ready') {
            this.driver.set(driverDetails(result.data.fleetDriver));
          }
          this.state.set('ready');
        }
      });
  }

  async save(form: DriverForm): Promise<void> {
    if (this.saving() || this.state() !== 'ready' || !this.editing) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const input = driverInput(form);
      const result = this.id
        ? await this.api.update({ id: this.id, input })
        : await this.api.create({ input });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.drawer()?.markSaved();
      this.saving.set(false);
      this.closingAfterSave = true;
      this.host.saved({
        recordId: result.id,
        message: interpolate(this.id ? this.text().notices.saved : this.text().notices.created, {
          name: `${result.firstName} ${result.lastName}`,
        }),
      });
      await this.navigate(this.listLink);
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

  edit(): void {
    if (this.id) {
      void this.navigate([...this.listLink, this.id, 'edit']);
    }
  }

  viewRecord(): void {
    if (this.id) {
      void this.navigate([...this.listLink, this.id]);
    }
  }

  openScorecard(): void {
    if (this.id) {
      void this.navigate([...this.listLink, this.id, 'scorecard']);
    }
  }

  openVehicle(vehicleId: string): void {
    if (this.driver()?.vehicles.some((vehicle) => vehicle.id === vehicleId)) {
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
  }

  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (this.drawer()?.canLeave() ?? true);
  }

  private navigate(commands: readonly unknown[]): Promise<boolean> {
    return this.router.navigate([...commands], {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.businessDate.set(null);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }

  private loadCreateContext(): void {
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          return this.api.watchContext().valueChanges.pipe(
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
          this.businessDate.set(result.data.fleetDataClock.businessDate);
          this.state.set('ready');
        }
      });
  }
}
