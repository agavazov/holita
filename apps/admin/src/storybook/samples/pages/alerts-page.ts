import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { type AlertAction, AlertDrawer } from '../../../app/features/fleet/alerts/alert-drawer';
import {
  type AlertActionId,
  type AlertKpis,
  AlertsView,
} from '../../../app/features/fleet/alerts/alerts-view';
import { alertsText } from '../../../app/features/fleet/alerts/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import {
  driverById,
  type SampleAlert,
  sampleAlerts,
  sampleNow,
  sampleVehicles,
  vehicleById,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { alertRow } from '../rows';
import {
  injectBranchName,
  injectClearDrawer,
  injectQueryParams,
  saveDelayMs,
  scenarioOf,
} from '../scenario';

const dataAsOf = new Date(sampleNow).toISOString();
/** PostgreSQL follows the enum declaration: INFO < WARNING < CRITICAL. */
const severityRank = { INFO: 0, WARNING: 1, CRITICAL: 2 } as const;
const statusRank = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 } as const;

const definition: SampleListDefinition<SampleAlert> = {
  id: (alert) => alert.id,
  search: (alert) => [
    alert.kind,
    alert.detail,
    alert.remark,
    vehicleById(alert.vehicleId)?.plate ?? null,
    driverById(alert.driverId)?.name ?? null,
  ],
  columns: {
    severity: (alert) => alert.severity,
    status: (alert) => alert.status,
    vehicle: (alert) => alert.vehicleId,
    occurredAt: (alert) => alert.occurredAt,
  },
  sortColumns: {
    severity: (alert) => severityRank[alert.severity],
    status: (alert) => statusRank[alert.status],
  },
  secondarySorts: {
    severity: [{ value: (alert) => alert.occurredAt, direction: 'desc' }],
  },
};

/** Match live counts: retain search and every non-status condition, across all pages. */
export function sampleAlertKpis(alerts: readonly SampleAlert[], query: ListQuery): AlertKpis {
  const matching = runSampleList(alerts, definition, {
    ...query,
    conditions: query.conditions.filter((condition) => condition.field !== 'status'),
    page: 1,
    pageSize: Math.max(1, alerts.length),
  }).items;
  const open = matching.filter((alert) => alert.status === 'OPEN');
  return {
    critical: open.filter((alert) => alert.severity === 'CRITICAL').length,
    open: open.length,
    acknowledged: matching.filter((alert) => alert.status === 'ACKNOWLEDGED').length,
    resolved: matching.filter((alert) => alert.status === 'RESOLVED').length,
  };
}

/** The list opens on the alerts still to handle; the chip can be removed like any filter. */
const notResolved = {
  id: 'default-status',
  field: 'status',
  operator: 'isNoneOf',
  values: ['RESOLVED'],
} as const;

/** The alert in the drawer. */
interface OpenDrawer {
  readonly id: string;
}

/**
 * Story-only host of the Alerts example: sample alerts, simulated workflow updates, and
 * `?scenario=` / `?drawer=<id>` for the states the stories open on.
 */
@Component({
  selector: 'holita-example-alerts-page',
  imports: [AlertsView, AlertDrawer],
  template: `
    <holita-alerts-view
      [branchName]="branchName()"
      [dataAsOf]="dataAsOf"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [selection]="selection()"
      (stateChange)="state.set($event)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
    />
    @if (openAlert(); as open) {
      <holita-alert-drawer
        [alert]="open.alert"
        [dataAsOf]="dataAsOf"
        [busy]="busy()"
        [saveError]="saveError()"
        (action)="apply(open.alert.id, $event.action, $event.remark)"
        (openVehicle)="openVehicle($event)"
        (closed)="closeDrawer()"
      />
    }
  `,
})
export class AlertsPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly alertDrawer = viewChild(AlertDrawer);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => alertsText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly branchName = injectBranchName();
  protected readonly dataAsOf = dataAsOf;
  protected readonly vehicles = sampleVehicles
    .filter((vehicle) => sampleAlerts.some((alert) => alert.vehicleId === vehicle.id))
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.plate }));
  protected readonly alerts = linkedSignal<readonly SampleAlert[]>(() =>
    this.scenario() === 'empty' ? [] : sampleAlerts,
  );
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'occurredAt', direction: 'desc' }, 20, [notResolved]),
  );
  protected readonly selection = signal<readonly ListRecord<AlertActionId>[]>([]);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  protected readonly drawer = linkedSignal<OpenDrawer | null>(() => {
    const id = this.query().get('drawer');
    return id ? { id } : null;
  });
  protected readonly openAlert = computed(() => {
    const drawer = this.drawer();
    const alert = drawer ? this.alerts().find((item) => item.id === drawer.id) : undefined;
    return drawer && alert ? { alert: alertRow(alert) } : null;
  });
  protected readonly busy = signal<AlertAction | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly result = computed(() =>
    runSampleList(this.alerts(), definition, this.state()),
  );
  protected readonly rows = computed(() => this.result().items.map(alertRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed()
      ? null
      : sampleAlertKpis(this.alerts(), this.state()),
  );
  protected readonly view = computed(() =>
    sampleTableView(this.state(), this.rows().length, {
      loading: this.scenario() === 'loading',
      failed: this.failed(),
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  canLeave(): Promise<boolean> | boolean {
    return this.alertDrawer()?.canLeave() ?? true;
  }

  /** Row and bulk actions alike: the view already left out alerts an action does not apply to. */
  protected run({ action, ids }: ListActionRequest<AlertActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'open':
        if (id) {
          this.drawer.set({ id });
        }
        return;
      case 'acknowledge':
        this.update(ids, 'acknowledge');
        this.selection.update((selection) =>
          selection.filter((record) => !ids.includes(record.id)),
        );
        return;
      case 'resolve':
        if (id) {
          this.drawer.set({ id });
        }
        return;
      case 'vehicle': {
        const alert = id ? this.alerts().find((item) => item.id === id) : undefined;
        if (alert) {
          this.openVehicle(alert.vehicleId);
        }
        return;
      }
    }
  }

  /** A drawer action: applied after the simulated latency, or failed once in `save-error`. */
  protected apply(id: string, action: AlertAction, remark: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(action);
    this.saveError.set(null);
    this.saveTimer = setTimeout(() => {
      this.busy.set(null);
      if (this.failNextSave()) {
        this.failNextSave.set(false);
        this.saveError.set(this.text().drawer.saveError);
        return;
      }
      this.update([id], action, remark);
      if (action !== 'reopen') {
        this.closeDrawer();
      }
    }, saveDelayMs);
  }

  protected openVehicle(vehicleId: string): void {
    void this.router.navigate(['/examples/vehicles', vehicleId]);
  }

  protected closeDrawer(): void {
    this.saveError.set(null);
    this.drawer.set(null);
    this.clearDrawer();
  }

  /** Changes exactly these alerts: the list and the drawer offer only the steps that apply. */
  private update(ids: readonly string[], action: AlertAction, remark?: string): void {
    const status =
      action === 'acknowledge' ? 'ACKNOWLEDGED' : action === 'resolve' ? 'RESOLVED' : 'OPEN';
    this.alerts.update((alerts) =>
      alerts.map((alert) =>
        ids.includes(alert.id)
          ? { ...alert, status, remark: remark === undefined ? alert.remark : remark }
          : alert,
      ),
    );
    if (action === 'reopen') {
      return;
    }
    const template =
      action === 'acknowledge' ? this.text().notices.acknowledged : this.text().notices.resolved;
    this.messages.add({
      severity: 'success',
      summary: interpolate(template, { count: ids.length }),
    });
  }
}
