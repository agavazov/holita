import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { map } from 'rxjs';
import type {
  AdminDeviceConfigurationOperationFragment,
  AdminDeviceConfigurationPageQuery,
  AdminDeviceConfigurationTargetsQuery,
  AdminRequestDeviceConfigurationReadMutationVariables,
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { deviceConfigurationText } from './i18n/messages';
import { DeviceParameterEditor, type DeviceParameterPreset } from './device-parameter-editor';

export type DeviceConfigurationState = 'loading' | 'ready' | 'not-found' | 'invalid-id' | 'error';
export type DeviceConfigurationTarget = AdminDeviceConfigurationTargetsQuery['karmaCars'][number];
export type DeviceConfigurationOperation = AdminDeviceConfigurationOperationFragment;

export function deviceReadPending(operation: DeviceConfigurationOperation): boolean {
  return (
    operation.status === 'QUEUED' ||
    operation.status === 'SUBMITTING' ||
    operation.status === 'WAITING' ||
    operation.status === 'UNKNOWN'
  );
}

@Component({
  selector: 'holita-device-configuration-view',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Message,
    Select,
    TableModule,
    Tag,
    EmptyState,
    FormField,
    FormatDateTimePipe,
    FormatNumberPipe,
    PageHeader,
    TablePanel,
    DeviceParameterEditor,
  ],
  templateUrl: './device-configuration-view.html',
  styleUrl: './device-configuration-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DeviceConfigurationView {
  readonly state = input<DeviceConfigurationState>('loading');
  readonly device = input<AdminDeviceConfigurationPageQuery['fleetDevice'] | null>(null);
  readonly enabled = input(false);
  readonly writesEnabled = input(false);
  readonly presets = input<readonly DeviceParameterPreset[]>([]);
  readonly acceptedOperationId = input<string | null>(null);
  readonly writeError = input<string | null>(null);
  readonly writeFieldErrors = input<
    Partial<Record<'catalogId' | 'parameterId' | 'intervalSeconds', string>>
  >({});
  readonly operations = input<readonly DeviceConfigurationOperation[]>([]);
  readonly lastSnapshot = input<DeviceConfigurationOperation | null>(null);
  readonly targets = input<readonly DeviceConfigurationTarget[]>([]);
  readonly targetsState = input<'loading' | 'ready' | 'error'>('loading');
  readonly requesting = input(false);
  readonly refreshing = input(false);
  readonly reconciling = input(false);
  readonly loadError = input<string | null>(null);
  readonly pollError = input<string | null>(null);
  readonly requestError = input<string | null>(null);
  readonly targetsError = input<string | null>(null);
  readonly backLink = input.required<readonly string[]>();
  readonly requestRead = output<AdminRequestDeviceConfigurationReadMutationVariables['input']>();
  readonly requestAddition =
    output<AdminRequestDeviceParameterAdditionMutationVariables['input']>();
  readonly requestIntervalUpdate =
    output<AdminRequestDeviceParameterIntervalUpdateMutationVariables['input']>();
  readonly writeDraftChanged = output();
  readonly refresh = output();
  readonly retryTargets = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly editor = viewChild(DeviceParameterEditor);
  private readonly snapshotTitle = viewChild<ElementRef<HTMLHeadingElement>>('snapshotTitle');
  protected readonly text = computed(() => deviceConfigurationText(this.language()));
  readonly form = new FormGroup({
    carId: new FormControl<string | null>(null, (control) => Validators.required(control)),
    confirmed: new FormControl(false, {
      nonNullable: true,
      validators: (control) => Validators.requiredTrue(control),
    }),
  });
  private readonly carId = toSignal(this.form.controls.carId.valueChanges, { initialValue: null });
  private readonly selectedSnapshotId = signal<string | null>(null);
  protected readonly target = computed(
    () => this.targets().find((target) => target.id === this.carId()) ?? null,
  );
  private readonly targetIdentity = computed(() => {
    const target = this.target();
    return target ? JSON.stringify([target.id, target.deviceId]) : null;
  });
  private readonly confirmedIdentity = toSignal(
    this.form.controls.confirmed.valueChanges.pipe(
      map((confirmed) => (confirmed ? this.targetIdentity() : null)),
    ),
    { initialValue: null },
  );
  protected readonly targetOptions = computed(() =>
    this.targets().map((target) => ({
      id: target.id,
      label: `${target.carNumber} · ${target.id} · ${target.deviceId}`,
    })),
  );
  protected readonly pending = computed(() => this.operations().some(deviceReadPending));
  protected readonly snapshotOperation = computed(() => {
    const operations = this.operations();
    return (
      operations.find(
        (operation) => operation.id === this.selectedSnapshotId() && operation.configuration,
      ) ?? this.lastSnapshot()
    );
  });
  protected readonly parameters = computed(() => [
    ...(this.snapshotOperation()?.configuration?.parameters ?? []),
  ]);
  protected readonly snapshotHeading = computed(() =>
    this.selectedSnapshotId() && this.snapshotOperation()?.id !== this.lastSnapshot()?.id
      ? this.text().savedResult
      : this.text().result,
  );
  protected readonly viewingHistoricalSnapshot = computed(
    () => !!this.lastSnapshot() && this.snapshotOperation()?.id !== this.lastSnapshot()?.id,
  );
  protected readonly intervalEditingUnavailable = computed(() => {
    const target = this.target();
    const snapshot = this.lastSnapshot();
    return (
      !this.writesEnabled() ||
      this.pending() ||
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.targetsState() !== 'ready' ||
      !target ||
      !snapshot ||
      this.viewingHistoricalSnapshot() ||
      snapshot.karmaCarId !== target.id ||
      snapshot.karmaDeviceId !== target.deviceId
    );
  });
  protected readonly unavailable = computed(
    () =>
      !this.enabled() ||
      this.pending() ||
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.targetsState() !== 'ready' ||
      !this.targets().length,
  );
  protected readonly selectPt = {
    label: { 'aria-describedby': 'configuration-target-hint configuration-target-error' },
    listContainer: { tabindex: 0 },
  };

  constructor() {
    effect(() => {
      if (this.unavailable()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
    effect(() => {
      this.targetIdentity();
      this.form.controls.confirmed.setValue(false);
    });
  }

  submit(): void {
    const device = this.device();
    const target = this.target();
    if (
      this.unavailable() ||
      !device ||
      !target ||
      this.form.invalid ||
      this.confirmedIdentity() !== this.targetIdentity()
    ) {
      this.form.markAllAsTouched();
      return;
    }
    this.requestRead.emit({
      deviceId: device.id,
      karmaCarId: target.id,
      expectedKarmaDeviceId: target.deviceId,
    });
  }

  showSnapshot(id: string): void {
    this.selectedSnapshotId.set(id);
    this.focusSnapshot();
  }

  showLatestSnapshot(): void {
    this.selectedSnapshotId.set(null);
    this.focusSnapshot();
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.requesting() && (this.editor()?.canLeave() ?? true);
  }

  editInterval(parameterId: number): Promise<void> | undefined {
    return this.editor()?.editInterval(parameterId);
  }

  private focusSnapshot(): void {
    afterNextRender(
      () => {
        this.snapshotTitle()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected statusSeverity(status: DeviceConfigurationOperation['status']) {
    switch (status) {
      case 'COMPLETE':
        return 'success';
      case 'FAILED':
        return 'danger';
      case 'TIMED_OUT':
      case 'UNKNOWN':
        return 'warn';
      default:
        return 'info';
    }
  }

  protected readonly trackParameter = (
    _index: number,
    parameter: NonNullable<DeviceConfigurationOperation['configuration']>['parameters'][number],
  ) => parameter.parameterId;
}
