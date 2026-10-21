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
import { VehicleDrawer, type VehicleForm } from './vehicle-drawer';
import { VehicleChoices } from './vehicle-choices';
import { vehicleFieldErrors, vehicleForm, vehicleInput } from './vehicle-mapping';
import { VehiclesApi } from './vehicles-api';
import { vehiclesText } from './i18n/messages';

@Component({
  selector: 'holita-vehicle-editor-page',
  imports: [VehicleDrawer],
  providers: [VehiclesApi, VehicleChoices],
  template: `
    <holita-vehicle-drawer
      [vehicle]="vehicle()"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="listLink"
      [groups]="choices.groups()"
      [drivers]="assignableDrivers()"
      [choicesError]="choicesFailure()"
      (retryChoices)="choices.load()"
      [saving]="saving()"
      [saveError]="saveFailure()"
      [fieldErrors]="fieldErrors()"
      (save)="save($event)"
      (retry)="retry.next()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleEditorPage implements OnInit {
  private readonly api = inject(VehiclesApi);
  protected readonly choices = inject(VehicleChoices);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(VehicleDrawer);
  private closingAfterSave = false;
  private readonly routeData = drawerRouteData(this.route);
  readonly id = this.routeData.mode === 'create' ? null : drawerParam(this.route, 'recordId');
  readonly listLink = this.host.closeLink ?? [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'vehicles',
  ];
  readonly vehicle = signal<VehicleForm | null>(null);
  protected readonly assignableDrivers = computed(() =>
    this.choices
      .drivers()
      .filter((driver) => driver.status !== 'INACTIVE' || driver.id === this.vehicle()?.driverId),
  );
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => vehiclesText(this.language()));
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().table.errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? requestError(this.saveError(), this.text().drawer.saveError) : null,
  );
  protected readonly fieldErrors = computed(() =>
    vehicleFieldErrors(this.saveError(), this.language()),
  );
  protected readonly choicesFailure = computed(() =>
    this.choices.error() ? requestError(this.choices.error(), this.text().table.errorText) : null,
  );

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Vehicles editor needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (this.id === null && this.routeData.mode === 'create') {
      this.choices.load();
      this.state.set('ready');
      return;
    }
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.choices.load();
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          return this.api.watchVehicle(id).valueChanges.pipe(
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
          if (this.state() !== 'ready') {
            this.vehicle.set(vehicleForm(result.data.fleetVehicle));
          }
          this.state.set('ready');
        }
      });
  }

  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }

  async save(form: VehicleForm): Promise<void> {
    if (this.saving() || this.state() !== 'ready') {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const input = vehicleInput(form);
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
          plate: result.licensePlate,
        }),
      });
      await this.close();
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

  close(): Promise<boolean> {
    return this.router.navigate(this.listLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (!this.saving() && (this.drawer()?.canLeave() ?? true));
  }
}
