import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { merge } from 'rxjs';
import type {
  AdminDeviceConfigurationPageQuery,
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { confirmDialogPt, confirmDiscard } from '../../../ui/confirm';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import { integerValidator, validationMessage } from '../../../ui/forms/validators';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type {
  DeviceConfigurationOperation,
  DeviceConfigurationTarget,
} from './device-configuration-view';
import { deviceConfigurationText } from './i18n/messages';

export type DeviceParameterPreset =
  AdminDeviceConfigurationPageQuery['fleetDeviceParameterPresets'][number];
type EditorField = 'presetKey' | 'parameterId' | 'intervalSeconds' | 'confirmed' | 'zeroConfirmed';
const fieldOrder: readonly EditorField[] = [
  'presetKey',
  'parameterId',
  'intervalSeconds',
  'zeroConfirmed',
  'confirmed',
];

@Component({
  selector: 'holita-device-parameter-editor',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    ConfirmDialog,
    InputNumber,
    Message,
    Select,
    FormField,
    FormatDateTimePipe,
    FormatNumberPipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './device-parameter-editor.html',
  styles: `
    .parameter-wrap {
      overflow-wrap: anywhere;
    }
    .parameter-details > summary {
      cursor: pointer;
      color: var(--p-text-muted-color);
      padding-block: var(--p-app-space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class DeviceParameterEditor {
  readonly deviceId = input.required<string>();
  readonly enabled = input(false);
  readonly target = input<DeviceConfigurationTarget | null>(null);
  readonly latestBaseline = input<DeviceConfigurationOperation | null>(null);
  readonly presets = input<readonly DeviceParameterPreset[]>([]);
  readonly busy = input(false);
  readonly submitting = input(false);
  readonly acceptedOperationId = input<string | null>(null);
  readonly requestError = input<string | null>(null);
  readonly serverFieldErrors = input<
    Partial<Record<'catalogId' | 'parameterId' | 'intervalSeconds', string>>
  >({});
  readonly addition = output<AdminRequestDeviceParameterAdditionMutationVariables['input']>();
  readonly intervalUpdate =
    output<AdminRequestDeviceParameterIntervalUpdateMutationVariables['input']>();
  readonly draftChanged = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly confirmation = inject(ConfirmationService);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  private pendingLeave: Promise<boolean> | null = null;
  private confirmedKey: string | null = null;
  private submitted = false;
  private resetting = false;
  private readonly draftContext = signal<string | null>(null);
  private readonly capturedBaseline = signal<DeviceConfigurationOperation | null>(null);
  protected readonly text = computed(() => deviceConfigurationText(this.language()).editor);
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
  readonly form = new FormGroup({
    mode: new FormControl<'add' | 'interval'>('add', { nonNullable: true }),
    presetKey: new FormControl<string | null>(null),
    parameterId: new FormControl<number | null>(null),
    intervalSeconds: new FormControl<number | null>(
      null,
      integerValidator(0, 65000, { required: true }),
    ),
    zeroConfirmed: new FormControl(false, { nonNullable: true }),
    confirmed: new FormControl(false, { nonNullable: true }),
  });
  private readonly events = toSignal(this.form.events);
  protected readonly value = computed(() => {
    this.events();
    return this.form.getRawValue();
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  private readonly context = computed(() => {
    const target = this.target();
    const baseline = this.latestBaseline();
    return JSON.stringify([this.deviceId(), target?.id, target?.deviceId, baseline?.id]);
  });
  protected readonly baseline = computed(() => this.capturedBaseline() ?? this.latestBaseline());
  protected readonly stale = computed(
    () => this.draftContext() !== null && this.draftContext() !== this.context(),
  );
  protected readonly matchingBaseline = computed(() => {
    const baseline = this.baseline();
    const target = this.target();
    return (
      !!target &&
      !!baseline?.configuration &&
      baseline.status === 'COMPLETE' &&
      baseline.deviceId === this.deviceId() &&
      baseline.karmaCarId === target.id &&
      baseline.karmaDeviceId === target.deviceId
    );
  });
  protected readonly unavailable = computed(
    () => !this.enabled() || this.busy() || !this.matchingBaseline() || this.stale(),
  );
  protected readonly modes = computed(() => [
    { value: 'add', label: this.text().add },
    { value: 'interval', label: this.text().update },
  ]);
  protected readonly parameterOptions = computed(() =>
    (this.baseline()?.configuration?.parameters ?? []).map((parameter) => ({
      value: parameter.parameterId,
      label: String(parameter.parameterId),
    })),
  );
  protected readonly presetOptions = computed(() =>
    this.presets()
      .filter(
        (preset) =>
          !this.baseline()?.configuration?.parameters.some(
            (parameter) => parameter.parameterId === preset.parameterId,
          ),
      )
      .map((preset) => ({
        value: JSON.stringify([preset.catalogId, preset.parameterId]),
        label: `${String(preset.parameterId)} · ${preset.name} · ${preset.catalogLabel}`,
      })),
  );
  protected readonly preset = computed(
    () =>
      this.presets().find(
        (preset) =>
          JSON.stringify([preset.catalogId, preset.parameterId]) === this.value().presetKey,
      ) ?? null,
  );
  protected readonly previous = computed(
    () =>
      this.baseline()?.configuration?.parameters.find(
        (parameter) => parameter.parameterId === this.value().parameterId,
      ) ?? null,
  );
  protected readonly intendedParameterId = computed(() =>
    this.value().mode === 'add'
      ? (this.preset()?.parameterId ?? null)
      : (this.previous()?.parameterId ?? null),
  );
  private readonly intentKey = computed(() =>
    JSON.stringify([
      this.context(),
      this.value().mode,
      this.value().presetKey,
      this.intendedParameterId(),
      this.value().intervalSeconds,
    ]),
  );
  protected readonly numberPt = computed(() =>
    innerInputPt('parameter-intervalSeconds', !!this.errorOf('intervalSeconds')),
  );
  protected readonly presetPt = computed(() => this.selectPt('presetKey'));
  protected readonly parameterPt = computed(() => this.selectPt('parameterId'));

  constructor() {
    merge(
      this.form.controls.mode.valueChanges,
      this.form.controls.presetKey.valueChanges,
      this.form.controls.parameterId.valueChanges,
      this.form.controls.intervalSeconds.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.resetting) {
          return;
        }
        this.draftChanged.emit();
        if (this.draftContext() === null) {
          this.draftContext.set(this.context());
          this.capturedBaseline.set(this.latestBaseline());
        }
        this.form.controls.intervalSeconds.updateValueAndValidity({ emitEvent: false });
        this.form.controls.confirmed.setValue(false);
        this.form.controls.zeroConfirmed.setValue(false);
        this.confirmedKey = null;
      });
    this.form.controls.confirmed.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.confirmedKey = value ? this.intentKey() : null;
      });
    effect(() => {
      const context = this.context();
      untracked(() => {
        if (this.draftContext() !== null && context !== this.draftContext()) {
          this.form.controls.confirmed.setValue(false);
          this.confirmedKey = null;
        }
      });
    });
    effect(() => {
      const unavailable = this.unavailable();
      untracked(() => {
        if (unavailable) {
          this.form.disable({ emitEvent: false });
        } else {
          this.form.enable({ emitEvent: false });
        }
      });
    });
    effect(() => {
      const accepted = this.acceptedOperationId();
      if (accepted) {
        untracked(() => {
          this.reset();
        });
      }
    });
    effect(() => {
      if (!this.busy() && (this.requestError() || Object.keys(this.serverFieldErrors()).length)) {
        this.focusInvalid();
      }
    });
    this.destroyRef.onDestroy(() => {
      this.confirmation.close();
    });
  }

  protected errorOf(name: EditorField): string | null {
    this.events();
    const server = this.serverFieldErrors();
    const serverError =
      name === 'presetKey'
        ? (server.catalogId ?? (this.value().mode === 'add' ? server.parameterId : undefined))
        : name === 'parameterId' || name === 'intervalSeconds'
          ? server[name]
          : undefined;
    if (serverError) {
      return serverError;
    }
    const control = this.form.controls[name];
    if (!control.touched && !this.submitted) {
      return null;
    }
    if (name === 'presetKey' && this.value().mode === 'add' && !this.preset()) {
      return this.text().presetRequired;
    }
    if (name === 'parameterId' && this.value().mode === 'interval' && !this.previous()) {
      return this.text().parameterRequired;
    }
    if (name === 'confirmed' && (!control.value || this.confirmedKey !== this.intentKey())) {
      return this.text().confirmationRequired;
    }
    if (name === 'zeroConfirmed' && this.value().intervalSeconds === 0 && !control.value) {
      return this.text().zeroRequired;
    }
    if (name === 'intervalSeconds' && control.hasError('unchanged')) {
      return this.text().unchanged;
    }
    return validationMessage(control.errors, this.language());
  }

  protected submit(): void {
    if (this.unavailable()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const target = this.target();
    const baseline = this.baseline();
    const parameterId = this.intendedParameterId();
    if (
      !target ||
      !baseline ||
      parameterId === null ||
      value.intervalSeconds === null ||
      this.form.invalid ||
      !value.confirmed ||
      this.confirmedKey !== this.intentKey() ||
      (value.intervalSeconds === 0 && !value.zeroConfirmed)
    ) {
      this.focusInvalid();
      return;
    }
    if (value.mode === 'interval' && value.intervalSeconds === this.previous()?.intervalSeconds) {
      this.form.controls.intervalSeconds.setErrors({ unchanged: true });
      this.focusInvalid();
      return;
    }
    const input = {
      deviceId: this.deviceId(),
      karmaCarId: target.id,
      expectedKarmaDeviceId: target.deviceId,
      baselineOperationId: baseline.id,
      parameterId,
      intervalSeconds: value.intervalSeconds,
    };
    if (value.mode === 'add') {
      const preset = this.preset();
      if (preset) {
        this.addition.emit({ ...input, catalogId: preset.catalogId });
      }
    } else {
      this.intervalUpdate.emit(input);
    }
  }

  canLeave(): boolean | Promise<boolean> {
    if (this.submitting() && this.form.dirty) {
      return false;
    }
    if (!this.form.dirty) {
      return true;
    }
    this.pendingLeave ??= confirmDiscard(this.confirmation, this.language()).finally(() => {
      this.pendingLeave = null;
    });
    return this.pendingLeave;
  }

  async editInterval(parameterId: number): Promise<void> {
    if (this.unavailable()) {
      return;
    }
    const context = this.context();
    if (!(await this.canLeave()) || context !== this.context() || this.unavailable()) {
      return;
    }
    const parameter = this.latestBaseline()?.configuration?.parameters.find(
      (item) => item.parameterId === parameterId,
    );
    if (!parameter) {
      return;
    }
    this.reset();
    this.form.patchValue({
      mode: 'interval',
      parameterId,
      intervalSeconds: parameter.intervalSeconds,
    });
    afterNextRender(
      () => {
        this.formElement()
          ?.nativeElement.ownerDocument.getElementById('parameter-intervalSeconds')
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty) {
      event.preventDefault();
    }
  }

  protected discard(): void {
    if (!this.submitting()) {
      this.reset();
      this.draftChanged.emit();
    }
  }

  private reset(): void {
    this.submitted = false;
    this.confirmedKey = null;
    this.resetting = true;
    this.form.reset({
      mode: 'add',
      presetKey: null,
      parameterId: null,
      intervalSeconds: null,
      confirmed: false,
      zeroConfirmed: false,
    });
    this.resetting = false;
    this.draftContext.set(null);
    this.capturedBaseline.set(null);
  }

  private selectPt(name: 'presetKey' | 'parameterId') {
    return {
      listContainer: { tabindex: 0 },
      label: {
        'aria-invalid': this.errorOf(name) ? 'true' : undefined,
        'aria-describedby': `parameter-${name}-hint parameter-${name}-error`,
      },
    };
  }

  private focusInvalid(): void {
    afterNextRender(
      () => {
        const form = this.formElement()?.nativeElement;
        if (form) {
          focusFirstInvalid(form, fieldOrder, 'parameter-');
        }
      },
      { injector: this.injector },
    );
  }
}
