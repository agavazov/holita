import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { toneSeverity } from '../../ui/tones';
import type {
  AdminControlCenterConfigurationChangesQuery,
  AdminControlCenterConfigurationBatchQuery,
  AdminControlCenterParameterBaselineQuery,
  AdminControlCenterSettingsDevicesQuery,
  ErmConfigurationOperation,
  StartErmEdataChangeInput,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { FormField } from '../../ui/form-field/form-field';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { interpolate } from '../../ui/i18n/messages';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../ui/list/list-actions';
import { RowActions } from '../../ui/row-actions/row-actions';
import { selectMultiplePt } from '../../ui/select-multiple';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { ControlCenterApi } from './control-center-api';
import {
  controlCenterError,
  controlCenterReason,
  controlCenterText,
  deviceLabel,
} from './control-center-text';

type SettingsMode = ErmConfigurationOperation;
type Run =
  AdminControlCenterConfigurationChangesQuery['fleetDevice']['ermConfigurationChanges'][number];
type Batch = NonNullable<AdminControlCenterConfigurationBatchQuery['ermConfigurationBatch']>;
type Baseline =
  AdminControlCenterParameterBaselineQuery['fleetDevice']['ermParameterSnapshots']['items'][number];
type Device = AdminControlCenterSettingsDevicesQuery['fleetDevices']['items'][number];
type ParameterForm = FormGroup<{
  parameter: FormControl<string>;
  value: FormControl<string>;
}>;
const protectedParameters = new Set([49, 50, 51, 52, 53, 54, 59, 60, 61, 187, 524, 525, 593]);
interface Step {
  name: string;
  time: string;
  outcome: string;
  payload: string | null;
}

@Component({
  selector: 'holita-device-settings',
  imports: [
    JsonPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    ConfirmDialog,
    Dialog,
    InputText,
    Message,
    Select,
    TableModule,
    Tag,
    FormField,
    RowActions,
    TablePanel,
  ],
  providers: [ConfirmationService],
  templateUrl: './device-settings.html',
  styles: 'pre { white-space: pre-wrap; overflow-wrap: anywhere; }',
  host: { class: 'app-tab-content' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSettings {
  readonly deviceId = input.required<string>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly primary = input(false);
  protected readonly text = computed(() => controlCenterText[this.language()].settings);
  protected readonly common = computed(() => controlCenterText[this.language()]);
  protected readonly auditText = computed(() => controlCenterText[this.language()].queue);
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-settings-confirm-message'),
  );
  private readonly api = inject(ControlCenterApi);
  private readonly session = inject(DemoSession);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly canRead = computed(() => this.session.hasRole('OPERATOR'));
  protected readonly canWrite = computed(() => this.session.hasRole('ENGINEER'));
  protected readonly selectMultiplePt = selectMultiplePt;
  protected readonly confirmationMessage = signal('');
  protected readonly units = injectFleetFormat();
  protected readonly form = new FormGroup({
    mode: new FormControl<SettingsMode>('READ_EDATA', { nonNullable: true }),
    parameterId: new FormControl<number | null>(null),
    intervalSeconds: new FormControl<number | null>(null),
    definitionHex: new FormControl('', { nonNullable: true }),
    globalsHex: new FormControl('', { nonNullable: true }),
    parameter: new FormControl('', { nonNullable: true }),
    value: new FormControl('', { nonNullable: true }),
    parameters: new FormArray<ParameterForm>([]),
    batch: new FormControl(false, { nonNullable: true }),
    deviceIds: new FormControl<string[]>([], { nonNullable: true }),
    restoreAfter: new FormControl(false, { nonNullable: true }),
  });
  protected readonly parameterSelection = new FormControl<string[]>([], { nonNullable: true });
  private readonly selectedParameters = toSignal(this.parameterSelection.valueChanges, {
    initialValue: this.parameterSelection.value,
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });
  protected readonly mode = toSignal(this.form.controls.mode.valueChanges, {
    initialValue: this.form.controls.mode.value,
  });
  protected readonly modes = computed(() => {
    const labels = this.text().modes;
    const modes: readonly SettingsMode[] = [
      'READ_EDATA',
      'INTERVAL',
      'ADD_DEFINITION',
      'GLOBALS',
      'PARAMETER',
      'PARAMETERS',
    ];
    return modes.map((value) => ({ value, label: labels[value] }));
  });
  protected readonly baseline = signal<Baseline | null>(null);
  protected readonly parameterOptions = computed(() =>
    (this.baseline()?.values ?? [])
      .filter(
        (entry) =>
          !protectedParameters.has(entry.parameter) &&
          !/\b(?:password|secret|lock|unlock|PIN)\b/i.test(entry.title ?? ''),
      )
      .map((entry) => ({
        value: this.parameter(entry.parameter),
        label: `${this.parameter(entry.parameter)} · ${entry.title ?? '—'}`,
      })),
  );
  protected readonly plannedChange = computed(() => {
    this.formValue();
    const value = this.form.getRawValue();
    const parameters =
      value.mode === 'PARAMETER'
        ? [{ parameter: value.parameter, value: value.value }]
        : value.mode === 'PARAMETERS'
          ? value.parameters
          : [];
    return parameters
      .filter((entry) => entry.parameter)
      .map((entry) => {
        const current = this.baseline()?.values.find(
          (current) => current.parameter === Number(entry.parameter),
        );
        return {
          parameter: entry.parameter,
          title: current?.title ?? '—',
          current: current?.outcome === 'READ' ? current.value : null,
          value: entry.value,
        };
      });
  });
  protected readonly planColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'parameter',
      label: this.text().parameter,
      width: '20rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'current', label: this.text().currentValue, width: '16rem' },
    { id: 'value', label: this.text().plannedValue, width: '16rem' },
  ]);
  protected readonly isBatch = computed(() => {
    this.formValue();
    return this.mode() === 'PARAMETERS' && this.form.controls.batch.value;
  });
  protected readonly devices = signal<readonly Device[]>([]);
  protected readonly devicesTotal = signal(0);
  protected readonly devicesLoading = signal(false);
  private readonly devicesOffset = signal(0);
  protected readonly deviceOptions = computed(() =>
    this.devices().map((device) => ({
      value: device.id,
      label: `${deviceLabel(device)} · ${device.imei}`,
      disabled:
        !device.ermConfigurationWritesEnabled ||
        device.ermState?.online !== true ||
        device.ermState.mode !== 'PRIMARY',
    })),
  );
  protected readonly batch = signal<Batch | null>(null);
  protected readonly stoppingBatch = signal(false);
  private readonly batchId = signal<string | null>(null);
  private readonly activeBatchId = computed(
    () => this.batchId() ?? this.runs().find((run) => run.batchId)?.batchId ?? null,
  );
  protected readonly batchRunning = computed(
    () => this.batch() !== null && this.batch()?.finishedAt === null,
  );
  protected readonly batchProgress = computed(() =>
    interpolate(this.text().batchProgress, {
      completed: this.batch()?.changes.filter((change) => change.finishedAt !== null).length ?? 0,
      total: this.batch()?.changes.length ?? 0,
    }),
  );
  protected readonly batchBaselineHint = computed(() =>
    interpolate(this.text().batchBaselineHint, {
      target: this.target(),
    }),
  );
  protected readonly batchRows = computed(() => this.batch()?.changes ?? []);
  protected readonly batchColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'unit',
      label: this.auditText().target,
      width: '20rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'status', label: this.common().status, width: '16rem', kind: 'status' },
  ]);
  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly trackById = trackById;
  protected readonly tableMinWidth = '60rem';
  protected readonly actions = computed<readonly ListAction<'details', Run>[]>(() => [
    { id: 'details', label: this.text().details },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'operation',
      label: this.text().operation,
      width: '18rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'started', label: this.text().started, width: '12rem', kind: 'date' },
    { id: 'status', label: this.common().status, width: '13rem', kind: 'status' },
    {
      id: 'finished',
      label: this.text().finished,
      width: '12rem',
      kind: 'date',
      className: 'app-col-secondary',
    },
    {
      id: 'actions',
      label: this.text().actions,
      width: '5rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly historyView = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.runs().length,
      filtered: false,
    }),
  );
  protected readonly historyRows = computed(() => [...this.runs()]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedRun = computed(
    () => this.runs().find((run) => run.id === this.selectedId()) ?? null,
  );
  protected readonly writesEnabled = signal(false);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);
  protected readonly running = computed(() =>
    this.runs().some(
      (run) => run.finishedAt === null && run.status !== 'FAILED' && run.status !== 'REFUSED',
    ),
  );
  protected readonly disabledReason = computed(() => {
    this.formValue();
    if (this.mode() === 'READ_EDATA' ? !this.canRead() : !this.canWrite()) {
      return this.mode() === 'READ_EDATA'
        ? this.text().readRoleRequired
        : this.text().writeRoleRequired;
    }
    if (this.mode() !== 'READ_EDATA' && !this.writesEnabled()) {
      return this.text().writesDisabled;
    }
    if (this.isBatch()) {
      if (!this.form.controls.deviceIds.value.length) {
        return this.text().batchDevices;
      }
      if (this.form.controls.deviceIds.value.length > 100) {
        return this.text().batchHint;
      }
    } else if (!this.primary()) {
      return this.text().primaryRequired;
    }
    if (
      (this.mode() === 'PARAMETER' || this.mode() === 'PARAMETERS') &&
      !this.plannedChange().length
    ) {
      return this.text().parametersRequired;
    }
    return null;
  });

  constructor() {
    effect(() => {
      const selected = this.selectedParameters();
      untracked(() => {
        const previous = new Map(
          this.form.controls.parameters.controls.map((control) => [
            control.controls.parameter.value,
            control,
          ]),
        );
        this.form.controls.parameters.clear({ emitEvent: false });
        for (const parameter of selected) {
          this.form.controls.parameters.push(
            previous.get(parameter) ??
              new FormGroup({
                parameter: new FormControl(parameter, { nonNullable: true }),
                value: new FormControl('', { nonNullable: true }),
              }),
            { emitEvent: false },
          );
        }
        this.form.controls.parameters.updateValueAndValidity();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const subscription = this.api.watchParameterBaseline(this.deviceId()).valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.error.set(
              controlCenterError(result.error, this.language(), this.text().unavailable),
            );
          } else if (result.dataState === 'complete') {
            this.baseline.set(result.data.fleetDevice.ermParameterSnapshots.items[0] ?? null);
          }
        },
        error: (error: unknown) => {
          this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      if (!this.isBatch()) {
        return;
      }
      const offset = this.devicesOffset();
      this.devicesLoading.set(true);
      const subscription = this.api.watchSettingsDevices(offset).valueChanges.subscribe({
        next: (result) => {
          this.devicesLoading.set(result.loading);
          if (result.error) {
            this.error.set(
              controlCenterError(result.error, this.language(), this.text().unavailable),
            );
          } else if (result.dataState === 'complete') {
            const page = result.data.fleetDevices;
            this.devicesTotal.set(page.total);
            this.devices.update((current) =>
              offset === 0
                ? page.items
                : [
                    ...current,
                    ...page.items.filter(
                      (device) => !current.some((existing) => existing.id === device.id),
                    ),
                  ],
            );
          }
        },
        error: (error: unknown) => {
          this.devicesLoading.set(false);
          this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      const id = this.activeBatchId();
      if (!id) {
        return;
      }
      const query = this.api.watchConfigurationBatch(id, () => this.batch()?.finishedAt != null);
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.error.set(
              controlCenterError(result.error, this.language(), this.text().unavailable),
            );
          } else if (result.dataState === 'complete') {
            this.batch.set(result.data.ermConfigurationBatch);
          }
        },
        error: (error: unknown) => {
          this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const id = this.deviceId();
      this.loading.set(true);
      const subscription = this.api
        .watchConfigurationChanges(id, () => !this.running())
        .valueChanges.subscribe({
          next: (result) => {
            this.loading.set(result.loading);
            if (result.dataState === 'complete' && !result.error) {
              this.runs.set(result.data.fleetDevice.ermConfigurationChanges);
              this.writesEnabled.set(result.data.fleetDevice.ermConfigurationWritesEnabled);
            }
            if (result.error) {
              this.error.set(
                controlCenterError(result.error, this.language(), this.text().unavailable),
              );
            }
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
          },
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected async submit(): Promise<void> {
    if (
      this.disabledReason() ||
      this.form.invalid ||
      this.submitting() ||
      this.running() ||
      this.batchRunning()
    ) {
      return;
    }
    const value = this.form.getRawValue();
    if (value.mode !== 'READ_EDATA' && !this.writesEnabled()) {
      return;
    }
    this.confirmationMessage.set(
      this.isBatch()
        ? interpolate(this.text().batchConfirm, {
            operation: this.text().modes[value.mode],
            count: value.deviceIds.length,
          })
        : interpolate(this.text().confirm, {
            target: this.target(),
            operation: this.text().modes[value.mode],
          }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().start,
      acceptLabel: this.text().start,
      danger: value.mode !== 'READ_EDATA',
    });
    if (!accepted) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      if (value.mode === 'PARAMETERS' && value.batch) {
        const batch = await this.api.startParameterBatch({
          deviceIds: value.deviceIds,
          parameters: value.parameters,
          restoreAfter: value.restoreAfter,
        });
        this.batch.set(batch);
        this.batchId.set(batch.id);
      } else if (value.mode === 'PARAMETERS') {
        await this.api.startParametersChange({
          deviceId: this.deviceId(),
          parameters: value.parameters,
          restoreAfter: value.restoreAfter,
        });
      } else if (value.mode === 'PARAMETER') {
        await this.api.startParameterChange({
          deviceId: this.deviceId(),
          parameter: value.parameter,
          value: value.value,
          restoreAfter: value.restoreAfter,
        });
      } else {
        const input: StartErmEdataChangeInput = {
          deviceId: this.deviceId(),
          ...(value.mode === 'READ_EDATA' ? { read: true } : { restoreAfter: value.restoreAfter }),
          ...(value.mode === 'INTERVAL'
            ? { parameterId: value.parameterId, intervalSeconds: value.intervalSeconds }
            : {}),
          ...(value.mode === 'ADD_DEFINITION' ? { definitionHex: value.definitionHex } : {}),
          ...(value.mode === 'GLOBALS' ? { globalsHex: value.globalsHex } : {}),
        };
        await this.api.startEdataChange(input);
      }
      this.reload.update((value) => value + 1);
    } catch (error) {
      this.error.set(controlCenterError(error, this.language(), this.text().uncertain));
      this.reload.update((value) => value + 1);
    } finally {
      this.submitting.set(false);
    }
  }

  protected refreshHistory(): void {
    this.error.set(null);
    this.reload.update((value) => value + 1);
  }
  protected operation(run: Run): string {
    const label = this.text().modes[run.operation];
    const targets = run.parameters.length
      ? run.parameters
      : run.parameter === null
        ? []
        : [run.parameter];
    return targets.length
      ? `${label} · ${targets.map((value) => this.parameter(value)).join(', ')}`
      : label;
  }
  protected failureReason(reason: string): string {
    return controlCenterReason(reason, this.language());
  }
  protected parameter(value: number): string {
    return String(value).padStart(4, '0');
  }
  protected loadMoreDevices(): void {
    this.devicesOffset.set(this.devices().length);
  }
  protected async stopBatch(): Promise<void> {
    const id = this.activeBatchId();
    if (!id || !this.canWrite() || this.stoppingBatch()) {
      return;
    }
    this.stoppingBatch.set(true);
    try {
      this.batch.set(await this.api.stopConfigurationBatch(id));
    } catch (error: unknown) {
      this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
    } finally {
      this.stoppingBatch.set(false);
    }
  }
  protected record(run: Run) {
    return listRecord(this.actions(), run, run.id, this.operation(run));
  }
  protected historyAction(action: ListActionRequest<'details'>): void {
    this.selectedId.set(action.ids[0] ?? null);
  }
  protected stateLabel(status: Run['status']): string {
    return this.text().states[status];
  }

  protected severity(status: Run['status']) {
    return toneSeverity(
      status === 'UNCERTAIN' || status === 'RESTORE_FAILED' || status === 'FAILED'
        ? 'danger'
        : status === 'MISMATCH' || status === 'REFUSED'
          ? 'warn'
          : status === 'RUNNING'
            ? 'info'
            : 'success',
    );
  }
  protected steps(value: unknown): readonly Step[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const entries: unknown[] = value;
    return entries.flatMap((step) => {
      if (
        typeof step !== 'object' ||
        step === null ||
        !('name' in step) ||
        typeof step.name !== 'string' ||
        !('time' in step) ||
        typeof step.time !== 'string' ||
        !('outcome' in step) ||
        typeof step.outcome !== 'string'
      ) {
        return [];
      }
      return [
        {
          name: step.name,
          time: step.time,
          outcome: step.outcome,
          payload: 'payload' in step && typeof step.payload === 'string' ? step.payload : null,
        },
      ];
    });
  }
  protected stepLabel(value: string): string {
    const labels: Readonly<Record<string, string>> = this.text().steps;
    return labels[value] ?? value;
  }
}
