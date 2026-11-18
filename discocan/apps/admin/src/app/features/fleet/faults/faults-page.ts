import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CheckCircle } from '@primeicons/angular/check-circle';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { MinusCircle } from '@primeicons/angular/minus-circle';
import { PowerOff } from '@primeicons/angular/power-off';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  catchError,
  EMPTY,
  exhaustMap,
  filter,
  merge,
  share,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import type {
  AdminFaultLogQuery,
  FleetFaultLogKind,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { WALL_CLOCK } from '../../../ui/clock';
import {
  faultFmi,
  faultReadResult,
  faultsText,
  findingCode,
  findingTitle,
  warningLampLabel,
  type FleetFaultFinding,
} from '../../../ui/fleet-live/fault-wording';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatNumber, formatRelative } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { trackById } from '../../../ui/list/list-actions';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { fleetRecordLinks } from '../fleet-record-links';
import { FaultsApi } from './faults-api';
import {
  faultTrucks,
  truckStateTone,
  type CanState,
  type FaultMonitorRow,
  type FaultTruck,
  type TruckFaultState,
} from './faults-model';
import { faultsPageText } from './faults-text';

type LogEntry = AdminFaultLogQuery['fleetFaultLog']['items'][number];

interface LogFilter {
  readonly vehicleId: string | null;
  readonly kind: FleetFaultLogKind | null;
  readonly range: readonly (Date | null)[] | null;
}

const emptyFilter: LogFilter = { vehicleId: null, kind: null, range: null };
const logKinds: readonly FleetFaultLogKind[] = [
  'FAULT_ADDED',
  'FAULT_REMOVED',
  'FAULT_READ',
  'CAN_LOST',
  'CAN_RESTORED',
  'LAMP_ON',
  'LAMP_OFF',
  'FREEZE_FRAME',
];
const kindTone: Readonly<Record<FleetFaultLogKind, 'danger' | 'warn' | 'info' | 'success'>> = {
  FAULT_ADDED: 'danger',
  FAULT_REMOVED: 'success',
  FAULT_READ: 'info',
  CAN_LOST: 'warn',
  CAN_RESTORED: 'success',
  LAMP_ON: 'danger',
  LAMP_OFF: 'success',
  FREEZE_FRAME: 'info',
};
const REFRESH_MS = 60_000;

/** Fleet-wide fault monitoring: state tiles, one row per truck and the fault log. */
@Component({
  selector: 'discocan-faults-page',
  imports: [
    FormsModule,
    RouterLink,
    CheckCircle,
    ExclamationTriangle,
    MinusCircle,
    PowerOff,
    DatePicker,
    Select,
    TableModule,
    Tag,
    KpiStrip,
    KpiTile,
    PageHeader,
    TablePanel,
  ],
  providers: [FaultsApi],
  templateUrl: './faults-page.html',
  styleUrl: './faults-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class FaultsPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();

  private readonly api = inject(FaultsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly wallClock = inject(WALL_CLOCK);
  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => faultsPageText(this.language()));
  protected readonly faults = computed(() => faultsText(this.language()));
  protected readonly links = computed(() => fleetRecordLinks(this.language(), this.branchId()));
  protected readonly trackById = trackById;
  protected readonly now = signal(this.wallClock());
  private readonly visible = () => this.document.visibilityState === 'visible';
  private readonly refresh = new Subject<void>();

  private readonly rows = signal<readonly FaultMonitorRow[] | null>(null);
  protected readonly monitorLoading = signal(true);
  protected readonly monitorError = signal<unknown>(null);
  protected readonly trucks = computed(() => {
    const rows = this.rows();
    return rows ? faultTrucks(rows, this.now()) : null;
  });
  protected readonly counts = computed(() => {
    const counts: Record<TruckFaultState, number> = {
      ACTIVE: 0,
      OFFLINE: 0,
      NO_CAN: 0,
      CLEAR: 0,
      NOT_CHECKED: 0,
    };
    for (const truck of this.trucks() ?? []) {
      counts[truck.state] += 1;
    }
    return counts;
  });
  protected readonly truckColumns = computed<readonly TableColumn[]>(() => [
    { id: 'truck', label: this.text().trucks.truck, width: '12%', kind: 'identity' },
    { id: 'state', label: this.text().trucks.state, width: '15%', kind: 'status' },
    { id: 'codes', label: this.text().trucks.codes, width: '30%' },
    { id: 'lastCheck', label: this.text().trucks.lastCheck, width: '17%' },
    { id: 'lastData', label: this.text().trucks.lastData, width: '12%', kind: 'date' },
    { id: 'can', label: this.text().trucks.can, width: '14%', kind: 'status' },
  ]);
  protected readonly trucksView = computed(() =>
    tableView({
      loading: this.monitorLoading(),
      error: this.monitorError(),
      rows: this.trucks()?.length ?? null,
      filtered: false,
    }),
  );
  protected readonly monitorErrorText = computed(() =>
    requestError(this.monitorError(), this.text().trucks.errorText),
  );
  protected readonly tilesError = computed(() =>
    this.monitorError() && this.rows() === null ? this.monitorErrorText() : null,
  );

  protected readonly filter = signal<LogFilter>(emptyFilter);
  protected readonly pageState = signal({ page: 1, pageSize: 20 });
  protected readonly log = signal<AdminFaultLogQuery['fleetFaultLog'] | null>(null);
  protected readonly logLoading = signal(true);
  protected readonly logError = signal<unknown>(null);
  private readonly reloadLog = new Subject<void>();
  protected readonly vehicleOptions = computed(() => [
    { label: this.text().log.allVehicles, value: null },
    ...(this.rows() ?? [])
      .map((row) => ({ label: row.vehicle.licensePlate, value: row.vehicle.id }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  ]);
  protected readonly kindOptions = computed(() => [
    { label: this.text().log.allKinds, value: null },
    ...logKinds.map((kind) => ({ label: this.text().log.kinds[kind], value: kind })),
  ]);
  protected readonly logColumns = computed<readonly TableColumn[]>(() => [
    { id: 'occurredAt', label: this.text().log.time, width: '18%', kind: 'date' },
    { id: 'vehicle', label: this.text().log.vehicle, width: '14%', kind: 'identity' },
    { id: 'kind', label: this.text().log.kind, width: '18%', kind: 'status' },
    { id: 'details', label: this.text().log.details, width: '50%' },
  ]);
  protected readonly logView = computed(() => {
    const { vehicleId, kind, range } = this.filter();
    return tableView({
      loading: this.logLoading(),
      error: this.logError(),
      rows: this.log()?.items.length ?? null,
      filtered: !!(vehicleId ?? kind ?? range?.[0]),
    });
  });
  protected readonly logPage = computed(() => ({
    ...this.pageState(),
    total: this.log()?.total ?? 0,
  }));
  protected readonly logErrorText = computed(() =>
    requestError(this.logError(), this.text().log.errorText),
  );

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    const ticks = merge(timer(0, REFRESH_MS).pipe(filter(this.visible)), this.refresh).pipe(
      share(),
    );
    ticks
      .pipe(
        exhaustMap(() => {
          this.monitorLoading.set(true);
          return this.api.monitor().pipe(
            catchError((error: unknown) => {
              this.monitorError.set(error);
              this.monitorLoading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.now.set(this.wallClock());
        this.rows.set(rows);
        this.monitorError.set(null);
        this.monitorLoading.set(false);
      });
    merge(ticks, this.reloadLog)
      .pipe(
        switchMap(() => {
          this.logLoading.set(true);
          return this.api.log(this.logVariables()).pipe(
            catchError((error: unknown) => {
              this.logError.set(error);
              this.logLoading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((log) => {
        this.log.set(log);
        this.logError.set(null);
        this.logLoading.set(false);
      });
  }

  protected retryTrucks(): void {
    this.refresh.next();
  }

  protected count(state: TruckFaultState): string | null {
    return this.trucks() === null ? null : formatNumber(this.counts()[state], this.language());
  }

  protected stateLabel(state: TruckFaultState): string {
    return this.text().states[state];
  }

  protected canLabel(can: CanState): string {
    return this.text().can[can];
  }

  protected kindLabel(kind: FleetFaultLogKind): string {
    return this.text().log.kinds[kind];
  }

  protected stateSeverity(state: TruckFaultState) {
    return toneSeverity(truckStateTone[state]);
  }

  protected openLabel(plate: string): string {
    return interpolate(this.text().trucks.openTruck, { plate });
  }

  protected codeLine(finding: FleetFaultFinding): string {
    const code = findingCode(finding);
    const title = findingTitle(finding, this.language());
    return code && code !== title ? `${code} · ${title}` : title;
  }

  protected codeHint(finding: FleetFaultFinding): string | null {
    return finding.fmi === null ? null : faultFmi(finding.fmi, this.language());
  }

  protected lastCheck(truck: FaultTruck): string {
    return faultReadResult(truck.lastRead, this.language(), (iso) => this.timeOrDate(iso));
  }

  protected relative(iso: string | null): string {
    return formatRelative(iso, this.now(), this.language());
  }

  protected canTone(truck: FaultTruck) {
    return toneSeverity(
      truck.can === 'DATA' ? 'success' : truck.can === 'LOST' ? 'warn' : 'neutral',
    );
  }

  protected kindSeverity(kind: FleetFaultLogKind) {
    return toneSeverity(kindTone[kind]);
  }

  protected details(entry: LogEntry): string {
    const log = this.text().log;
    switch (entry.kind) {
      case 'FAULT_ADDED':
      case 'FAULT_REMOVED': {
        const meaning = Object.entries(this.faults().spn).find(
          ([key]) => `faults.spn.${key}` === entry.descriptionKey,
        )?.[1];
        const code =
          entry.spn === null
            ? (entry.troubleCode ?? this.faults().recordedFault)
            : `SPN ${String(entry.spn)} / FMI ${entry.fmi === null ? '—' : String(entry.fmi)}`;
        return meaning ? `${code} · ${meaning}` : code;
      }
      case 'FAULT_READ':
        return entry.activeCodes === null
          ? log.readNoAnswer
          : !entry.activeCodes
            ? log.readNoCodes
            : entry.codeCount === null
              ? log.readCodesFound
              : entry.codeCount === 1
                ? log.readCode
                : interpolate(log.readCodes, { count: entry.codeCount });
      case 'CAN_LOST':
        return log.canLost;
      case 'CAN_RESTORED':
        return log.canRestored;
      case 'LAMP_ON':
      case 'LAMP_OFF':
        return interpolate(log.lamp, {
          lamp: warningLampLabel(entry.parameterId ?? 0, this.language()),
          state: entry.lampState ? this.faults().states[entry.lampState] : '—',
        });
      case 'FREEZE_FRAME':
        return interpolate(log.freezeFrame, { count: entry.valueCount ?? 0 });
    }
  }

  protected detailsHint(entry: LogEntry): string | null {
    if (entry.kind === 'FAULT_REMOVED') {
      return this.text().log.removedHint;
    }
    return entry.kind === 'FAULT_ADDED' && entry.fmi !== null
      ? faultFmi(entry.fmi, this.language())
      : null;
  }

  protected changeFilter(patch: Partial<LogFilter>): void {
    this.filter.update((current) => ({ ...current, ...patch }));
    this.pageState.update((state) => ({ ...state, page: 1 }));
    this.reloadLog.next();
  }

  protected clearFilters(): void {
    this.filter.set(emptyFilter);
    this.pageState.update((state) => ({ ...state, page: 1 }));
    this.reloadLog.next();
  }

  protected changePage(state: { page: number; pageSize: number }): void {
    this.pageState.set(state);
    this.reloadLog.next();
  }

  protected retryLog(): void {
    this.reloadLog.next();
  }

  /** HH:MM within a day, otherwise the date and time. */
  private timeOrDate(iso: string): string {
    return this.now() - Date.parse(iso) < 86_400_000
      ? this.format.time(iso)
      : this.format.dateTime(iso);
  }

  private logVariables() {
    const { vehicleId, kind, range } = this.filter();
    const { page, pageSize } = this.pageState();
    const from = range?.[0] ?? null;
    const to = range?.[1] ?? from;
    return {
      offset: (page - 1) * pageSize,
      limit: pageSize,
      filter: {
        vehicleIds: vehicleId ? [vehicleId] : null,
        kinds: kind ? [kind] : null,
        occurredFrom: from ? dayStart(from).toISOString() : null,
        occurredTo: to ? dayEnd(to).toISOString() : null,
      },
    };
  }
}

function dayStart(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

/** The next midnight: the log's upper bound is exclusive. */
function dayEnd(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}
