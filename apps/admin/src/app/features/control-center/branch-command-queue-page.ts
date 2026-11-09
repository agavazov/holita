import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  AdminControlCenterBranchCommandRequestsQuery,
  AdminControlCenterCommandBatchFieldsFragment,
  AdminControlCenterSettingsDevicesQuery,
  AdminControlCenterQueueDeviceLabelsQuery,
  ErmCommandRequestStatus,
  ErmDeviceAction,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { FormField } from '../../ui/form-field/form-field';
import {
  FLEET_DISPLAY,
  defaultFleetDisplay,
  injectFleetFormat,
} from '../../ui/format/fleet-format';
import { formatNumber } from '../../ui/format/format';
import { interpolate, uiMessages } from '../../ui/i18n/messages';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../ui/list/list-actions';
import { codecs, type ListDefinition } from '../../ui/list/list-state';
import { UrlListState } from '../../ui/list/url-list-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { RowActions } from '../../ui/row-actions/row-actions';
import { selectMultiplePt } from '../../ui/select-multiple';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { BranchContext } from '../branches/branch-context';
import {
  CommandDetails,
  commandPending,
  commandPurpose,
  type CommandRequest,
} from '../fleet/commands';
import { commandOutcome, commandSeverity } from '../fleet/commands/command-presentation';
import { FleetPreferences } from '../fleet/settings/fleet-preferences';
import { GeneralSettingsApi } from '../fleet/settings/general-settings-api';
import { ControlCenterApi } from './control-center-api';
import { commandError, controlCenterText } from './control-center-text';

const statuses: readonly ErmCommandRequestStatus[] = [
  'QUEUED',
  'SUBMITTING',
  'ANSWERED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'UNCERTAIN',
];
const readActions: readonly ErmDeviceAction[] = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_EDATA_DIAGNOSTICS',
  'READ_EDATA_FAULTS',
];
interface QueueFilters {
  readonly statuses: readonly ErmCommandRequestStatus[];
  readonly devices: readonly string[];
}
const queueDefinition: ListDefinition<QueueFilters, 'requested'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'requested', direction: 'DESC' },
  filters: { statuses: codecs.enumList(statuses), devices: codecs.idList(100) },
};
type QueueAction = 'details' | 'batch' | 'cancel' | 'retry';
type QueueDevice = AdminControlCenterSettingsDevicesQuery['fleetDevices']['items'][number];
type QueueLabel = AdminControlCenterQueueDeviceLabelsQuery['fleetDevices']['items'][number];
type CommandBatch = AdminControlCenterCommandBatchFieldsFragment;

@Component({
  selector: 'discocan-branch-command-queue',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Message,
    Select,
    TableModule,
    Tag,
    FormField,
    PageHeader,
    TablePanel,
    RowActions,
    CommandDetails,
  ],
  providers: [ControlCenterApi, ConfirmationService],
  templateUrl: './branch-command-queue-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class BranchCommandQueue implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  protected readonly catalog = computed(() => controlCenterText[this.language()]);
  protected readonly text = computed(() => this.catalog().branchQueue);
  protected readonly format = injectFleetFormat();
  private readonly api = inject(ControlCenterApi);
  private readonly session = inject(DemoSession);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly canOperate = computed(() => this.session.hasRole('OPERATOR'));
  protected readonly url = new UrlListState(queueDefinition);
  protected readonly selectMultiplePt = selectMultiplePt;
  protected readonly trackById = trackById;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly page = signal<
    AdminControlCenterBranchCommandRequestsQuery['ermCommandRequests'] | null
  >(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly devices = signal<readonly QueueDevice[]>([]);
  protected readonly deviceTotal = signal(0);
  protected readonly devicesLoading = signal(true);
  protected readonly devicesError = signal<string | null>(null);
  private readonly reload = signal(0);
  private readonly deviceOffset = signal(0);
  private readonly deviceReload = signal(0);
  private readonly rowLabels = signal<readonly QueueLabel[]>([]);
  private readonly rowDeviceIds = computed(() =>
    [...new Set(this.page()?.items.map((request) => request.deviceId) ?? [])].sort().join(','),
  );
  protected readonly selected = signal<CommandRequest | null>(null);
  private readonly selectedId = computed(() => this.selected()?.id ?? null);
  protected readonly batch = signal<CommandBatch | null>(null);
  private readonly batchId = signal<string | null>(null);
  protected readonly confirmationMessage = signal('');
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'branch-command-confirm-message'),
  );
  protected readonly batchForm = new FormGroup({
    deviceIds: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [(control) => Validators.required(control), Validators.maxLength(100)],
    }),
    action: new FormControl<ErmDeviceAction>('READ_STATUS', {
      nonNullable: true,
      validators: [(control) => Validators.required(control)],
    }),
    intent: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    expiryMinutes: new FormControl(120, {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.min(1),
        Validators.max(1440),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });
  protected readonly batchFormStatus = toSignal(this.batchForm.statusChanges, {
    initialValue: this.batchForm.status,
  });
  protected readonly statusOptions = computed(() =>
    statuses.map((value) => ({ value, label: this.text().statuses[value] })),
  );
  protected readonly deviceOptions = computed(() =>
    this.devices().map((device) => ({
      value: device.id,
      label: device.vehicle ? `${device.vehicle.licensePlate} · ${device.imei}` : device.imei,
    })),
  );
  protected readonly actionOptions = computed(() =>
    readActions.map((value) => ({ value, label: this.catalog().actions[value] })),
  );
  protected readonly error = computed(() => this.actionError() ?? this.loadError());
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'command',
      label: this.text().command,
      width: '17rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'unit', label: this.text().unit, width: '14rem' },
    { id: 'status', label: this.text().status, width: '12rem', kind: 'status' },
    { id: 'waiting', label: this.text().waiting, width: '16rem' },
    { id: 'actor', label: this.text().actor, width: '13rem' },
    { id: 'requested', label: this.text().requested, width: '13rem', kind: 'date' },
    { id: 'completed', label: this.text().completed, width: '13rem', kind: 'date' },
    {
      id: 'actions',
      label: this.text().actions,
      width: '4rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly actions = computed<readonly ListAction<QueueAction, CommandRequest>[]>(() => [
    { id: 'details', label: this.text().details },
    { id: 'batch', label: this.text().batch, appliesTo: (request) => request.batchId !== null },
    {
      id: 'cancel',
      label: this.text().cancel,
      appliesTo: (request) =>
        this.canOperate() && this.busy() === null && request.status === 'QUEUED',
      confirm: { title: this.text().cancelConfirm, accept: this.text().cancel },
    },
    {
      id: 'retry',
      label: this.text().retry,
      appliesTo: (request) => this.canOperate() && this.busy() === null && this.retryable(request),
      confirm: {
        title: this.text().retryConfirm,
        detail: this.text().retryHint,
        accept: this.text().retry,
      },
    },
  ]);
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).map((request) => ({
      id: request.id,
      request,
      purpose: commandPurpose(request, this.language()),
      status: this.text().statuses[request.status],
      severity: commandSeverity(request),
      outcome: commandOutcome(request, this.language()),
      target: this.target(request),
      waiting: request.waitingReason ? this.text().waitingReasons[request.waitingReason] : null,
      waitingSince: this.format.dateTimeCell(request.waitingSince),
      requested: this.format.dateTimeCell(request.requestedAt),
      expires: this.format.dateTimeCell(request.expiresAt),
      answered: this.format.dateTimeCell(request.answeredAt),
      completed: this.format.dateTimeCell(request.completedAt),
      record: listRecord(
        this.actions(),
        request,
        request.id,
        `${commandPurpose(request, this.language())} · ${request.unitId}`,
      ),
    })),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.loadError(),
      rows: this.rows().length,
      filtered: !!(
        this.url.state().filter.statuses?.length || this.url.state().filter.devices?.length
      ),
    }),
  );
  protected readonly tablePage = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly batchRunning = computed(
    () => this.batch()?.requests.some(commandPending) ?? false,
  );
  protected readonly batchProgress = computed(() => {
    const batch = this.batch();
    return batch
      ? interpolate(this.text().batchProgress, {
          done: batch.requests.filter((request) => !commandPending(request)).length,
          total: batch.requests.length,
        })
      : '';
  });
  protected readonly batchState = computed(() =>
    this.batch()?.stoppedAt
      ? this.text().batchStopped
      : this.batchRunning()
        ? this.text().batchRunning
        : this.text().batchCompleted,
  );
  protected readonly batchCounts = computed(() =>
    (this.batch()?.counts ?? [])
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        ...entry,
        label: `${this.text().statuses[entry.status]}: ${formatNumber(entry.count, this.language())}`,
        severity: toneSeverity(
          entry.status === 'ANSWERED'
            ? 'success'
            : entry.status === 'FAILED'
              ? 'danger'
              : entry.status === 'UNCERTAIN' || entry.status === 'EXPIRED'
                ? 'warn'
                : 'info',
        ),
      })),
  );

  constructor() {
    effect((onCleanup) => {
      this.reload();
      const state = this.url.state();
      this.loading.set(true);
      const query = this.api.watchBranchCommandRequests({
        offset: (state.page - 1) * state.pageSize,
        limit: state.pageSize,
        filter: {
          statuses: state.filter.statuses ? [...state.filter.statuses] : undefined,
          deviceIds: state.filter.devices ? [...state.filter.devices] : undefined,
        },
      });
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.loadError.set(result.error ? commandError(result.error, this.language()) : null);
          if (result.dataState === 'complete' && !result.error) {
            this.page.set(result.data.ermCommandRequests);
            this.url.correctPage(
              Math.max(1, Math.ceil(result.data.ermCommandRequests.total / state.pageSize)),
            );
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(commandError(error, this.language()));
        },
      });
      const visible = () => {
        if (!document.hidden) {
          void query.refetch().catch(() => undefined);
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', visible);
      });
    });
    effect((onCleanup) => {
      this.reload();
      const id = this.selectedId();
      if (!id) {
        return;
      }
      const query = this.api.watchCommandRequest(id, () => {
        const request = this.selected();
        return request !== null && !commandPending(request);
      });
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.actionError.set(commandError(result.error, this.language()));
          } else if (result.dataState === 'complete') {
            this.selected.set(result.data.ermCommandRequest);
          }
        },
        error: (error: unknown) => {
          this.actionError.set(commandError(error, this.language()));
        },
      });
      const visible = () => {
        if (!document.hidden) {
          void query.refetch().catch(() => undefined);
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', visible);
      });
    });
    effect((onCleanup) => {
      this.deviceReload();
      const offset = this.deviceOffset();
      this.devicesLoading.set(true);
      const subscription = this.api.watchQueueDevices(offset).valueChanges.subscribe({
        next: (result) => {
          this.devicesLoading.set(result.loading);
          if (result.dataState === 'complete') {
            this.devicesError.set(null);
            this.deviceTotal.set(result.data.fleetDevices.total);
            const next = result.data.fleetDevices.items;
            this.devices.update((current) =>
              offset === 0
                ? next
                : [
                    ...current.filter((device) => !next.some((row) => row.id === device.id)),
                    ...next,
                  ],
            );
          }
        },
        error: () => {
          this.devicesLoading.set(false);
          this.devicesError.set(this.text().unitsUnavailable);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      const ids = this.rowDeviceIds();
      if (!ids) {
        this.rowLabels.set([]);
        return;
      }
      const subscription = this.api.watchQueueDeviceLabels(ids.split(',')).valueChanges.subscribe({
        next: (result) => {
          if (result.dataState === 'complete') {
            this.rowLabels.set(result.data.fleetDevices.items);
          }
        },
        error: () => {
          this.devicesError.set(this.text().unitsUnavailable);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      const batchId = this.batchId();
      if (!batchId) {
        return;
      }
      const query = this.api.watchCommandBatch(batchId, () => !this.batchRunning());
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.actionError.set(commandError(result.error, this.language()));
          } else if (result.dataState === 'complete' && result.data.ermCommandBatch) {
            this.batch.set(result.data.ermCommandBatch);
          }
        },
        error: (error: unknown) => {
          this.actionError.set(commandError(error, this.language()));
        },
      });
      const visible = () => {
        if (!document.hidden) {
          void query.refetch().catch(() => undefined);
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', visible);
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }
  protected target(request: CommandRequest | null): string {
    if (!request) {
      return '';
    }
    return (
      this.rowLabels().find((device) => device.id === request.deviceId)?.vehicle?.licensePlate ??
      this.devices().find((device) => device.id === request.deviceId)?.vehicle?.licensePlate ??
      request.unitId
    );
  }
  protected deviceLink(request: CommandRequest): string[] {
    return [
      '/',
      this.language(),
      this.branchId(),
      'fleet',
      'devices',
      request.deviceId,
      'commands',
    ];
  }
  protected loadMoreDevices(): void {
    this.deviceOffset.set(this.devices().length);
    this.deviceReload.update((value) => value + 1);
  }
  protected refresh(): void {
    this.actionError.set(null);
    this.reload.update((value) => value + 1);
  }
  private alive(): boolean {
    return !this.destroyRef.destroyed;
  }

  private retryable(request: CommandRequest): boolean {
    return ['FAILED', 'EXPIRED', 'UNCERTAIN', 'CANCELLED'].includes(request.status);
  }

  protected async run(event: ListActionRequest<QueueAction>): Promise<void> {
    const request = this.page()?.items.find((row) => row.id === event.ids[0]);
    if (!request) {
      return;
    }
    if (event.action === 'details') {
      this.selected.set(request);
      return;
    }
    if (event.action === 'batch') {
      this.batchId.set(request.batchId ?? null);
      return;
    }
    if (!this.canOperate() || this.busy() !== null) {
      return;
    }
    this.busy.set(request.id);
    this.actionError.set(null);
    try {
      const updated =
        event.action === 'cancel'
          ? await this.api.cancelCommand(request.deviceId, request.id)
          : await this.api.retryCommand({ requestId: request.id });
      if (!this.alive()) {
        return;
      }
      this.selected.set(updated);
      this.reload.update((value) => value + 1);
    } catch (error: unknown) {
      if (this.alive()) {
        this.actionError.set(commandError(error, this.language()));
      }
    } finally {
      if (this.alive()) {
        this.busy.set(null);
      }
    }
  }

  protected async cancelSelected(request: CommandRequest): Promise<void> {
    if (!this.canOperate() || request.status !== 'QUEUED' || this.busy() !== null) {
      return;
    }
    this.confirmationMessage.set(this.text().cancelConfirm);
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().cancel,
      acceptLabel: this.text().cancel,
      danger: false,
    });
    if (!accepted || !this.alive()) {
      return;
    }
    this.busy.set(request.id);
    this.actionError.set(null);
    try {
      const updated = await this.api.cancelCommand(request.deviceId, request.id);
      if (this.alive()) {
        this.selected.set(updated);
        this.reload.update((value) => value + 1);
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.actionError.set(commandError(error, this.language()));
      }
    } finally {
      if (this.alive()) {
        this.busy.set(null);
      }
    }
  }

  protected async startBatch(): Promise<void> {
    if (
      !this.canOperate() ||
      this.batchForm.invalid ||
      this.busy() !== null ||
      this.batchRunning()
    ) {
      return;
    }
    const values = this.batchForm.getRawValue();
    this.confirmationMessage.set(
      interpolate(this.text().batchConfirm, {
        action: this.catalog().actions[values.action],
        count: values.deviceIds.length,
      }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().batch,
      acceptLabel: this.text().batchStart,
      danger: false,
    });
    if (!accepted || !this.alive()) {
      return;
    }
    this.busy.set('batch');
    this.actionError.set(null);
    try {
      const batch = await this.api.startCommandBatch({
        deviceIds: values.deviceIds,
        action: values.action,
        expiresInSeconds: values.expiryMinutes * 60,
        intent: values.intent.trim() || undefined,
      });
      if (this.alive()) {
        this.batch.set(batch);
        this.batchId.set(batch.id);
        this.reload.update((value) => value + 1);
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.actionError.set(commandError(error, this.language()));
      }
    } finally {
      if (this.alive()) {
        this.busy.set(null);
      }
    }
  }

  protected async stopBatch(): Promise<void> {
    const batch = this.batch();
    if (
      !batch ||
      !this.canOperate() ||
      this.busy() !== null ||
      batch.stoppedAt ||
      !this.batchRunning()
    ) {
      return;
    }
    this.confirmationMessage.set(this.text().batchStopConfirm);
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().batchStop,
      acceptLabel: this.text().batchStop,
      danger: false,
    });
    if (!accepted || !this.alive()) {
      return;
    }
    this.busy.set('stop');
    this.actionError.set(null);
    try {
      const updated = await this.api.stopCommandBatch(batch.id);
      if (this.alive()) {
        this.batch.set(updated);
        this.reload.update((value) => value + 1);
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.actionError.set(commandError(error, this.language()));
      }
    } finally {
      if (this.alive()) {
        this.busy.set(null);
      }
    }
  }
}

@Component({
  selector: 'discocan-branch-command-queue-page',
  imports: [BranchCommandQueue, Message, ButtonDirective],
  providers: [
    GeneralSettingsApi,
    FleetPreferences,
    {
      provide: FLEET_DISPLAY,
      useFactory: () => {
        const preferences = inject(FleetPreferences);
        return computed(() => preferences.settings() ?? defaultFleetDisplay);
      },
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (scope of scopes(); track scope.token + ':' + scope.branchId + ':' + scope.language) {
      @if (preferences.settings()) {
        <discocan-branch-command-queue [branchId]="scope.branchId" [language]="scope.language" />
      } @else {
        <section class="app-card">
          <h1>{{ text().title }}</h1>
          @if (preferences.loading()) {
            <p role="status">{{ uiText().loading }}</p>
          } @else {
            <p-message severity="error">{{ preferencesFailure() }}</p-message>
            <button pButton type="button" (click)="preferences.retry()">
              {{ uiText().retry }}
            </button>
          }
        </section>
      }
    }
  `,
})
export class BranchCommandQueuePage {
  private readonly workspace = inject(AdminWorkspace);
  private readonly branches = inject(BranchContext);
  private readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly preferences = inject(FleetPreferences);
  protected readonly text = computed(
    () => controlCenterText[this.workspace.language()].branchQueue,
  );
  protected readonly uiText = computed(() => uiMessages[this.workspace.language()]);
  protected readonly preferencesFailure = computed(() =>
    requestError(this.preferences.error(), this.text().unavailable),
  );
  protected readonly scopes = computed(() => {
    const token = this.workspace.session.current()?.token;
    const branchId = this.params().get('branchId')?.toLowerCase();
    const branch = this.branches.branches()?.find((branch) => branch.id === branchId);
    return token && branch && this.enabled
      ? [{ token, branchId: branch.id, language: this.workspace.language() }]
      : [];
  });
  constructor() {
    effect(() => {
      const scope = this.scopes()[0];
      if (scope) {
        this.preferences.initialize(scope.branchId, scope.language);
      }
    });
  }
}
