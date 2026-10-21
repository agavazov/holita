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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminDeviceDetailsFragment } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormatDateTimePipe } from '../../../ui/format/format.pipes';
import { errorCode } from '../../../ui/forms/field-errors';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DevicesApi } from './devices-api';
import { devicesText } from './i18n/messages';
import { fleetRecordLinks } from '../fleet-record-links';

@Component({
  selector: 'holita-device-diagnostics-page',
  imports: [RouteDrawer, FormatDateTimePipe, ButtonDirective, RouterLink],
  providers: [DevicesApi],
  template: `<holita-route-drawer
    [title]="text().drawer.diagnostics"
    [subtitle]="record()?.imei ?? null"
    [state]="state()"
    [errorText]="failure()"
    [closeLink]="listLink"
    (retry)="retry.next()"
  >
    @if (record(); as device) {
      <p class="app-muted">{{ text().drawer.unavailable }}</p>
      <dl class="app-facts">
        <div>
          <dt>{{ text().drawer.imei }}</dt>
          <dd class="app-mono">{{ device.imei }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.status }}</dt>
          <dd>{{ text().statuses[device.status] }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.model }}</dt>
          <dd>{{ device.model ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.vehicle }}</dt>
          <dd>
            @if (device.vehicleId) {
              <a class="app-link" [routerLink]="recordLinks.vehicle(device.vehicleId).commands">{{
                device.vehicle?.licensePlate ?? '—'
              }}</a>
            } @else {
              {{ text().drawer.notInstalled }}
            }
          </dd>
        </div>
        <div>
          <dt>{{ text().drawer.lastSeen }}</dt>
          <dd>{{ device.lastReportedAt | holitaDateTime }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.firmware }}</dt>
          <dd>{{ device.firmwareVersion ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.options }}</dt>
          <dd>{{ device.options.join(', ') || '—' }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.sim }}</dt>
          <dd>{{ device.simIccid ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.simPhone }}</dt>
          <dd>{{ device.simPhoneNumber ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.installedAt }}</dt>
          <dd>{{ device.installedAt | holitaDateTime }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.signal }}</dt>
          <dd>{{ text().drawer.notAvailable }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.voltage }}</dt>
          <dd>{{ text().drawer.notAvailable }}</dd>
        </div>
        <div>
          <dt>{{ text().drawer.notes }}</dt>
          <dd>{{ device.notes ?? '—' }}</dd>
        </div>
      </dl>
    }
    @if (state() === 'ready' && record()) {
      <div drawerFooter class="app-drawer-actions">
        <a pButton severity="secondary" [routerLink]="configurationLink()">{{
          text().drawer.configuration
        }}</a>
        <button pButton type="button" (click)="edit()">{{ text().actions.edit }}</button>
      </div>
    }
  </holita-route-drawer>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceDiagnosticsPage implements OnInit {
  private readonly api = inject(DevicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly recordLinks = fleetRecordLinks(
    this.language(),
    drawerParam(this.route, 'branchId') ?? '',
  );
  private readonly destroyRef = inject(DestroyRef);
  protected readonly text = computed(() => devicesText(this.language()));
  readonly listLink = [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'devices',
  ];
  readonly record = signal<AdminDeviceDetailsFragment | null>(null);
  readonly configurationLink = computed(() => [
    ...this.listLink,
    this.record()?.id ?? '',
    'configuration',
  ]);
  readonly state = signal<RouteDrawerState>('loading');
  private readonly error = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  protected readonly failure = computed(() =>
    requestError(this.error(), this.text().table.errorText),
  );
  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId'),
      id = drawerParam(this.route, 'recordId');
    if (!branch) {
      throw new Error('Device diagnostics needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    if (this.route.snapshot.queryParamMap.get('editFrom') === 'diagnostics') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { editFrom: null },
        queryParamsHandling: 'merge',
        preserveFragment: true,
        replaceUrl: true,
      });
    }
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.record.set(null);
          this.error.set(null);
          return this.api.watchDevice(id).valueChanges.pipe(
            catchError((error: unknown) => {
              this.fail(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.fail(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          this.record.set(result.data.fleetDevice);
          this.state.set('ready');
        }
      });
  }
  private fail(error: unknown): void {
    this.error.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
  canLeave(): boolean {
    return true;
  }
  edit(): void {
    const device = this.record();
    if (this.state() !== 'ready' || !device) {
      return;
    }
    void this.router.navigate([...this.listLink, device.id, 'edit'], {
      queryParams: { editFrom: 'diagnostics' },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }
}
