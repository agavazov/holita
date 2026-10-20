import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminFleetOverviewQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import type { SeriesPoint } from '../../../ui/charts/column-series';
import type { StackedRow } from '../../../ui/charts/stacked-bars';
import { formatDateOnly, formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { alertsText } from '../alerts/i18n/messages';
import { maintenanceText } from '../maintenance/i18n/messages';
import { overviewText } from './i18n/messages';
import { OverviewApi } from './overview-api';
import {
  OverviewView,
  type AttentionItem,
  type OverviewKpis,
  type OverviewLinks,
} from './overview-view';

@Component({
  selector: 'holita-overview-page',
  imports: [OverviewView, Message, ButtonDirective],
  providers: [OverviewApi],
  template: `
    @if (data() && failure(); as error) {
      <p-message severity="error"
        >{{ error }}
        <button pButton type="button" severity="secondary" [text]="true" (click)="refresh()">
          {{ text().retry }}
        </button></p-message
      >
    }
    <holita-overview-view
      [state]="state()"
      [branchName]="branch().name"
      [dataAsOf]="data()?.fleetOverview?.dataAsOf ?? null"
      [errorText]="failure()"
      [links]="links()"
      [tripLink]="tripLink"
      [kpis]="kpis()"
      [distance]="distance()"
      [activity]="activity()"
      [attention]="attention()"
      [trips]="trips()"
      (retry)="refresh()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(OverviewApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly data = signal<AdminFleetOverviewQuery | null>(null);
  readonly error = signal<unknown>(null);
  readonly loading = signal(true);
  readonly text = computed(() => overviewText(this.language()));
  readonly failure = computed(() =>
    this.error() ? requestError(this.error(), messages[this.language()].networkError) : null,
  );
  readonly state = computed(() => (this.data() ? 'ready' : this.error() ? 'error' : 'loading'));
  readonly links = computed<OverviewLinks>(() => {
    const base = ['/', this.language(), this.branch().id, 'fleet'];
    return {
      vehicles: [...base, 'vehicles'],
      alerts: [...base, 'alerts'],
      maintenance: [...base, 'maintenance'],
      trips: [...base, 'trips'],
    };
  });
  readonly tripLink = (id: string) => [...this.links().trips, id];
  readonly kpis = computed<OverviewKpis | null>(() => {
    const data = this.data()?.fleetOverview;
    return data
      ? {
          moving: data.movingVehicles,
          active: data.activeVehicles,
          distanceTodayKm: data.distanceTodayKm,
          criticalAlerts: data.openCriticalAlerts,
          overdueService: data.overdueService,
          notReporting: data.notReportingVehicles,
        }
      : null;
  });
  readonly distance = computed<readonly SeriesPoint[]>(() =>
    (this.data()?.fleetOverview.dailyDistance ?? []).map((point) => ({
      key: point.date,
      label: new Intl.DateTimeFormat(this.language(), {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Sofia',
      }).format(new Date(`${point.date}T12:00:00Z`)),
      value: point.distanceKm,
      valueText: `${formatNumber(point.distanceKm, this.language())} km`,
    })),
  );
  readonly activity = computed<readonly StackedRow[]>(() =>
    (this.data()?.fleetOverview.activityByGroup ?? []).map((row) => ({
      key: row.group?.id ?? 'ungrouped',
      label: row.group?.name ?? this.text().activity.ungrouped,
      total: row.total,
      totalText: formatNumber(row.total, this.language()),
      segments: [
        { key: 'moving', value: row.moving, tone: 'success' },
        { key: 'idle', value: row.idle, tone: 'info' },
        { key: 'parked', value: row.parked, tone: 'muted' },
        { key: 'notReporting', value: row.notReporting, tone: 'danger' },
        { key: 'asset', value: row.asset, tone: 'c1' },
        { key: 'noDevice', value: row.noDevice, tone: 'c2' },
      ],
    })),
  );
  readonly trips = computed(() =>
    (this.data()?.fleetTrips.items ?? []).map((trip) => ({
      id: trip.id,
      vehicleId: trip.vehicleId,
      plate: trip.vehicle.licensePlate,
      startedAt: trip.startedAt,
      from: trip.startAddress,
      to: trip.endAddress,
      distanceKm: trip.distanceKm,
    })),
  );
  readonly attention = computed<readonly AttentionItem[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const text = this.text().attention;
    const base = ['/', this.language(), this.branch().id, 'fleet'];
    return [
      ...data.critical.items.map((event) => ({
        key: `alert-${event.id}`,
        tone: 'danger' as const,
        title: `${alertsText(this.language()).kinds[event.kind]} · ${event.vehicle.licensePlate}`,
        detail: event.details ?? '',
        link: [...base, 'alerts', event.id],
      })),
      ...data.overdue.items.map((task) => ({
        key: `service-${task.id}`,
        tone: 'warn' as const,
        title: interpolate(text.overdue, {
          task: task.title ?? maintenanceText(this.language()).serviceTypes[task.serviceType],
          plate: task.vehicle.licensePlate,
        }),
        detail: task.dueOn
          ? interpolate(text.dueOn, { date: formatDateOnly(task.dueOn, this.language()) })
          : text.dueKm,
        link: [...base, 'maintenance', task.id, 'edit'],
      })),
      ...data.documents.items.map((driver) => ({
        key: `driver-${driver.id}`,
        tone: 'warn' as const,
        title: interpolate(text.document, { name: `${driver.firstName} ${driver.lastName}` }),
        detail: text.documentDetail,
        link: [...base, 'drivers', driver.id],
      })),
      ...(data.fleetDeviceSummary.offline
        ? [
            {
              key: 'offline',
              tone: 'danger' as const,
              title: interpolate(text.offline, { count: data.fleetDeviceSummary.offline }),
              detail: text.offlineDetail,
              link: [...base, 'devices'],
              queryParams: {
                conditions: JSON.stringify([
                  {
                    id: 'offline-status',
                    field: 'status',
                    operator: 'isAnyOf',
                    values: ['OFFLINE'],
                  },
                ]),
              },
            },
          ]
        : []),
    ];
  });

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.watch().valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete') {
          this.data.set(result.data);
        }
      });
  }
  refresh(): void {
    this.reload.next();
  }
}
