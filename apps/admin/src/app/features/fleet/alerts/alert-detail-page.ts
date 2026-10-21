import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { fleetRecordLinks, type FleetRecordLinks } from '../fleet-record-links';
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
import type { AdminAlertDetailsFragment } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { AlertDrawer, type AlertAction } from './alert-drawer';
import { alertRemarkError, alertRow } from './alert-mapping';
import { AlertsApi } from './alerts-api';
import { alertsText } from './i18n/messages';

@Component({
  selector: 'holita-alert-detail-page',
  imports: [AlertDrawer],
  providers: [AlertsApi],
  template: `
    <holita-alert-drawer
      [recordLinks]="recordLinks"
      [alert]="alert()"
      [dataAsOf]="dataAsOf() ?? ''"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="listLink"
      [busy]="busy()"
      [saveError]="saveFailure()"
      [fieldError]="fieldError()"
      [clockError]="clockFailure()"
      (action)="apply($event.action, $event.remark)"
      (openVehicle)="openVehicle($event)"
      (retry)="retry.next()"
      (retryClock)="refreshClock()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDetailPage implements OnInit {
  private readonly api = inject(AlertsApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly baseLinks = fleetRecordLinks(
    this.language(),
    drawerParam(this.route, 'branchId') ?? '',
  );
  protected readonly recordLinks: FleetRecordLinks = {
    ...this.baseLinks,
    vehicle: (id) =>
      this.host.closeLink && this.host.vehicleId === id
        ? {
            commands: this.host.closeLink,
            queryParams: this.route.snapshot.queryParams,
            fragment: this.route.snapshot.fragment ?? undefined,
          }
        : this.baseLinks.vehicle(id),
  };
  private readonly drawer = viewChild(AlertDrawer);
  private readonly text = computed(() => alertsText(this.language()));
  private clockQuery: ReturnType<AlertsApi['watchClock']> | undefined;
  private alertQuery: ReturnType<AlertsApi['watchAlert']> | undefined;
  private closingAfterSave = false;
  readonly id = drawerParam(this.route, 'recordId');
  readonly listLink = this.host.closeLink ?? [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'alerts',
  ];
  readonly record = signal<AdminAlertDetailsFragment | null>(null);
  readonly state = signal<RouteDrawerState>('loading');
  readonly busy = signal<AlertAction | null>(null);
  readonly dataAsOf = signal<string | null>(null);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  readonly clockError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  readonly alert = computed(() => {
    const record = this.record();
    return record ? alertRow(record, this.language()) : null;
  });
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().table.errorText),
  );
  protected readonly saveFailure = computed(() => {
    const error = this.saveError();
    if (errorCode(error) === 'CONFLICT') {
      const notice =
        this.state() === 'ready'
          ? this.text().drawer.conflictRetry
          : this.text().drawer.conflictRefreshing;
      const requestId: unknown = CombinedGraphQLErrors.is(error)
        ? error.errors[0]?.extensions?.['requestId']
        : undefined;
      return typeof requestId === 'string' ? `${notice} (${requestId})` : notice;
    }
    return error ? requestError(error, this.text().drawer.saveError) : null;
  });
  protected readonly fieldError = computed(() =>
    alertRemarkError(this.saveError(), this.language()),
  );
  protected readonly clockFailure = computed(() =>
    this.clockError() ? requestError(this.clockError(), this.text().table.errorText) : null,
  );

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('An Alerts drawer needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.clockQuery = this.api.watchClock();
    this.clockQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.clockError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.dataAsOf.set(result.data.fleetDataClock.asOf);
        }
      },
      error: (error: unknown) => {
        this.clockError.set(error);
      },
    });
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          this.alertQuery = this.api.watchAlert(id);
          return this.alertQuery.valueChanges.pipe(
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
          const event = result.data.fleetEvent;
          if (
            event.alertStatus === null ||
            (this.host.vehicleId && event.vehicleId !== this.host.vehicleId)
          ) {
            this.state.set('not-found');
            return;
          }
          if (this.state() !== 'ready') {
            this.record.set(event);
          }
          this.state.set('ready');
        }
      });
  }
  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
  async apply(action: AlertAction, remark: string): Promise<void> {
    const record = this.record();
    if (this.busy() || this.state() !== 'ready' || !record?.alertStatus) {
      return;
    }
    this.busy.set(action);
    this.saveError.set(null);
    try {
      const event = await this.api.transition(action, {
        id: record.id,
        input: { expectedStatus: record.alertStatus, remark: remark.trim() || null },
      });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.record.set(event);
      this.drawer()?.markSaved();
      this.busy.set(null);
      const message =
        action === 'reopen'
          ? this.text().notices.reopened
          : interpolate(
              action === 'acknowledge'
                ? this.text().notices.acknowledged
                : this.text().notices.resolved,
              { count: 1 },
            );
      this.host.saved({ recordId: event.id, message });
      if (action !== 'reopen') {
        this.closingAfterSave = true;
        await this.close();
      }
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.saveError.set(error);
        if (errorCode(error) === 'CONFLICT') {
          this.state.set('loading');
          this.loadError.set(null);
          const query = this.alertQuery;
          if (!query) {
            this.failRead(new Error('Missing alert read.'));
            return;
          }
          try {
            const result = await query.refetch();
            if (!this.destroyRef.destroyed && result.error) {
              this.failRead(result.error);
            }
          } catch (readError: unknown) {
            if (!this.destroyRef.destroyed) {
              this.failRead(readError);
            }
          }
        }
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.busy.set(null);
        this.closingAfterSave = false;
      }
    }
  }
  refreshClock(): void {
    void this.clockQuery
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.clockError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.dataAsOf.set(result.data.fleetDataClock.asOf);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.clockError.set(error);
        }
      });
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
  close(): Promise<boolean> {
    return this.router.navigate(this.listLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (this.drawer()?.canLeave() ?? true);
  }
}
