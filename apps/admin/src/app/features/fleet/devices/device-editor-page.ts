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
import type { AdminDeviceDetailsFragment } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { drawerParam, drawerRouteData } from '../../../ui/drawer/drawer-route';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceDrawer, type DeviceForm } from './device-drawer';
import { DeviceChoices } from './device-choices';
import { deviceFieldErrors, deviceForm, deviceInput, deviceRow } from './device-mapping';
import { deviceModels } from './device-query';
import { DevicesApi } from './devices-api';
import { devicesText } from './i18n/messages';

@Component({
  selector: 'holita-device-editor-page',
  imports: [DeviceDrawer],
  providers: [DevicesApi, DeviceChoices],
  template: `<holita-device-drawer
    [device]="row()"
    [value]="value()"
    [state]="state()"
    [loadError]="loadFailure()"
    [closeLink]="closeLink"
    [models]="models"
    [vehicles]="choices.vehicles()"
    [choicesError]="choicesFailure()"
    [dataAsOf]="dataAsOf()"
    [saving]="saving()"
    [saveError]="saveFailure()"
    [fieldErrors]="fieldErrors()"
    (save)="save($event)"
    (retry)="retry.next()"
    (retryChoices)="choices.load()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceEditorPage implements OnInit {
  private readonly api = inject(DevicesApi);
  protected readonly choices = inject(DeviceChoices);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(DeviceDrawer);
  private closingAfterSave = false;
  private readonly routeData = drawerRouteData(this.route);
  readonly id = this.routeData.mode === 'create' ? null : drawerParam(this.route, 'recordId');
  readonly listLink = [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'devices',
  ];
  readonly models = deviceModels;
  readonly closeLink =
    this.id && this.route.snapshot.queryParamMap.get('editFrom') === 'diagnostics'
      ? [...this.listLink, this.id, 'diagnostics']
      : this.listLink;
  readonly record = signal<AdminDeviceDetailsFragment | null>(null);
  protected readonly row = computed(() => {
    const record = this.record();
    return record ? deviceRow(record) : null;
  });
  protected readonly value = computed(() => {
    const record = this.record();
    return record ? deviceForm(record) : null;
  });
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly dataAsOf = signal('');
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => devicesText(this.language()));
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().table.errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? requestError(this.saveError(), this.text().drawer.saveError) : null,
  );
  protected readonly fieldErrors = computed(() =>
    deviceFieldErrors(this.saveError(), this.language()),
  );
  protected readonly choicesFailure = computed(() =>
    this.choices.error() ? requestError(this.choices.error(), this.text().table.errorText) : null,
  );
  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Devices editor needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (
      this.id !== null &&
      (!this.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.id))
    ) {
      this.state.set('invalid-id');
      return;
    }
    this.choices.load();
    this.api
      .watchSummary()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.dataState === 'complete' && !result.error) {
            this.dataAsOf.set(result.data.fleetDeviceSummary.dataAsOf ?? '');
          }
        },
        error: () => {
          this.dataAsOf.set('');
        },
      });
    const id = this.id;
    if (id === null) {
      this.state.set('ready');
      return;
    }
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          return this.api.watchDevice(id).valueChanges.pipe(
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
            this.record.set(result.data.fleetDevice);
          }
          this.state.set('ready');
        }
      });
  }
  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
  async save(form: DeviceForm): Promise<void> {
    if (this.saving() || this.state() !== 'ready') {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const input = deviceInput(form);
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
          imei: result.imei,
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
    return this.router.navigate(this.closeLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || this.saving() || (this.drawer()?.canLeave() ?? true);
  }
}
