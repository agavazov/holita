import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { type AlertAction, AlertDrawer } from '../../../app/features/fleet/alerts/alert-drawer';
import {
  type AlertKpis,
  type AlertRow,
  AlertsView,
} from '../../../app/features/fleet/alerts/alerts-view';
import { alertsText } from '../../../app/features/fleet/alerts/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListQuery } from '../../../app/ui/list/list-query';
import type { TableNotice } from '../../../app/ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { fixtureBranches } from '../../session-fixtures';
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
import { injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const dataAsOf = new Date(sampleNow).toISOString();
const weekAgo = new Date(sampleNow - 7 * 86_400_000).toISOString();
/** Most severe first when sorted ascending, as a backend ranks the enum. */
const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
const statusRank = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 } as const;

const definition: SampleListDefinition<SampleAlert> = {
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
};

function toRow(alert: SampleAlert): AlertRow {
  return {
    ...alert,
    plate: vehicleById(alert.vehicleId)?.plate ?? '—',
    driverName: driverById(alert.driverId)?.name ?? null,
  };
}

function kpisOf(alerts: readonly SampleAlert[]): AlertKpis {
  const open = alerts.filter((alert) => alert.status === 'OPEN');
  return {
    critical: open.filter((alert) => alert.severity === 'CRITICAL').length,
    open: open.length,
    acknowledged: alerts.filter((alert) => alert.status === 'ACKNOWLEDGED').length,
    resolved: alerts.filter((alert) => alert.status === 'RESOLVED' && alert.occurredAt >= weekAgo)
      .length,
  };
}

/** The list opens on the alerts still to handle; the chip can be removed like any filter. */
const notResolved = {
  id: 'default-status',
  field: 'status',
  operator: 'isNoneOf',
  values: ['RESOLVED'],
} as const;

/**
 * Story-only host of the Alerts example: sample alerts, simulated workflow updates, and
 * `?scenario=` / `?drawer=<id>` for the states the stories open on.
 */
@Component({
  selector: 'holita-example-alerts-page',
  imports: [AlertsView, AlertDrawer],
  template: `
    <holita-alerts-view
      [branchName]="branchName"
      [dataAsOf]="dataAsOf"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [selection]="selection()"
      [notice]="notice()"
      (stateChange)="state.set($event)"
      (open)="openId.set($event)"
      (rowAction)="rowAction($event.action, $event.id)"
      (selectionChange)="selection.set($event)"
      (bulkAction)="bulkAction($event)"
      (retry)="failed.set(false)"
      (dismissNotice)="notice.set(null)"
    />
    @if (openAlert(); as alert) {
      <holita-alert-drawer
        [alert]="alert"
        [dataAsOf]="dataAsOf"
        [busy]="busy()"
        [saveError]="saveError()"
        (action)="apply(alert.id, $event.action, $event.remark)"
        (openVehicle)="openVehicle($event)"
        (closed)="closeDrawer()"
      />
    }
  `,
})
export class AlertsPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => alertsText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly dataAsOf = dataAsOf;
  protected readonly vehicles = sampleVehicles
    .filter((vehicle) => sampleAlerts.some((alert) => alert.vehicleId === vehicle.id))
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.plate }));
  protected readonly alerts = linkedSignal<readonly SampleAlert[]>(() =>
    this.scenario() === 'empty' ? [] : sampleAlerts,
  );
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'occurredAt', direction: 'desc' }, 25, [notResolved]),
  );
  protected readonly selection = signal<readonly string[]>([]);
  protected readonly notice = signal<TableNotice | null>(null);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  protected readonly openId = linkedSignal(() => this.query().get('drawer'));
  protected readonly openAlert = computed(() => {
    const alert = this.alerts().find((item) => item.id === this.openId());
    return alert ? toRow(alert) : null;
  });
  protected readonly busy = signal<AlertAction | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly result = computed(() =>
    runSampleList(this.alerts(), definition, this.state()),
  );
  protected readonly rows = computed(() => this.result().items.map(toRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.alerts()),
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

  protected rowAction(action: string, id: string): void {
    switch (action) {
      case 'open':
        this.openId.set(id);
        return;
      case 'acknowledge':
      case 'resolve':
        this.update([id], action, '');
        return;
      case 'vehicle': {
        const alert = this.alerts().find((item) => item.id === id);
        if (alert) this.openVehicle(alert.vehicleId);
        return;
      }
    }
  }

  protected bulkAction(action: string): void {
    if (action !== 'acknowledge' && action !== 'resolve') return;
    this.update(this.selection(), action, '');
    this.selection.set([]);
  }

  /** A drawer action: applied after the simulated latency, or failed once in `save-error`. */
  protected apply(id: string, action: AlertAction, remark: string): void {
    if (this.busy()) return;
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
      if (action !== 'reopen') this.closeDrawer();
    }, saveDelayMs);
  }

  protected openVehicle(vehicleId: string): void {
    void this.router.navigate(['/examples/vehicles', vehicleId]);
  }

  protected closeDrawer(): void {
    this.saveError.set(null);
    this.openId.set(null);
  }

  private update(ids: readonly string[], action: AlertAction, remark: string): void {
    const status =
      action === 'acknowledge' ? 'ACKNOWLEDGED' : action === 'resolve' ? 'RESOLVED' : 'OPEN';
    const changed = this.alerts().filter(
      (alert) =>
        ids.includes(alert.id) &&
        alert.status !== status &&
        !(action === 'acknowledge' && alert.status === 'RESOLVED'),
    );
    const changedIds = changed.map((alert) => alert.id);
    this.alerts.update((alerts) =>
      alerts.map((alert) =>
        changedIds.includes(alert.id)
          ? { ...alert, status, remark: remark || alert.remark }
          : alert,
      ),
    );
    if (action === 'reopen') return;
    const template =
      action === 'acknowledge' ? this.text().notices.acknowledged : this.text().notices.resolved;
    this.notice.set({
      severity: 'success',
      text: interpolate(template, { count: changedIds.length }),
    });
  }
}
