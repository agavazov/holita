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
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { selectMultiplePt } from '../../../ui/select-multiple';
import { deviceOptions } from './device-query';
import { FormField } from '../../../ui/form-field/form-field';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { isoToZonedWallTime, zonedWallTimeInstants } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { lockWhileSaving } from '../../../ui/forms/saving';
import { patternValidator, textValidator, validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { DeviceRow } from './devices-view';
import { deviceModelLabel, devicesText } from './i18n/messages';

/** The editable device fields, as the register and update mutations take them. */
export interface DeviceForm {
  readonly imei: string;
  readonly model: string;
  readonly simIccid: string;
  readonly vehicleId: string | null;
  readonly notes: string;
  readonly serialNumber?: string;
  readonly options?: readonly string[];
  readonly firmwareVersion?: string;
  readonly edataModule?: string;
  readonly simPhoneNumber?: string;
  readonly smsPassword?: string;
  readonly installedAt?: string;
}

export type DeviceField = keyof DeviceForm;

const fieldOrder: readonly DeviceField[] = [
  'imei',
  'serialNumber',
  'model',
  'options',
  'simIccid',
  'simPhoneNumber',
  'smsPassword',
  'firmwareVersion',
  'edataModule',
  'installedAt',
  'vehicleId',
  'notes',
];

/** Device registration and installation editor. Live diagnostics belong to the device page. */
@Component({
  selector: 'discocan-device-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Message,
    Select,
    Textarea,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './device-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceDrawer {
  /** The device to edit; null registers a new one. */
  readonly device = input<DeviceRow | null>(null);
  readonly value = input<DeviceForm | null>(null);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly choicesError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  readonly models = input<readonly string[]>([]);
  readonly vehicles = input<readonly { readonly id: string; readonly name: string }[]>([]);
  readonly saving = input(false);
  readonly canEdit = input(true);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<DeviceField, string>>>({});
  readonly save = output<DeviceForm>();
  readonly closed = output();
  readonly retry = output();
  readonly retryChoices = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  private readonly timeZone = computed(() => this.units.preferences().timeZone);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly multiplePt = computed(() => ({
    ...selectMultiplePt,
    label: {
      'aria-multiselectable': null,
      'aria-invalid': this.errorOf('options') ? 'true' : undefined,
      'aria-describedby': this.describedBy('options'),
    },
  }));
  private readonly catalog = computed(() => devicesText(this.language()));
  protected readonly optionChoices = computed(() =>
    deviceOptions.map((value) => ({ value, label: this.catalog().optionLabels[value] })),
  );
  protected readonly text = computed(() => this.catalog().drawer);
  protected readonly modelSubtitle = computed(
    () => deviceModelLabel(this.language(), this.device()?.model) || null,
  );
  protected readonly installedAtHint = computed(() =>
    interpolate(this.text().installedAtHint, {
      timeZone: this.timeZone(),
    }),
  );

  protected readonly form = new FormGroup({
    imei: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(15, { required: true }), patternValidator(/^\d{15}$/)],
    }),
    serialNumber: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(32), patternValidator(/^[0-9A-Za-z-]{1,32}$/)],
    }),
    model: new FormControl<string | null>(null),
    options: new FormControl<readonly string[]>([], { nonNullable: true }),
    firmwareVersion: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(32), patternValidator(/^[0-9A-Za-z._-]{1,32}$/)],
    }),
    edataModule: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(64), patternValidator(/^[ -~]{1,64}$/)],
    }),
    simPhoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(20), patternValidator(/^\+?[0-9]{6,19}$/)],
    }),
    smsPassword: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(16), patternValidator(/^[0-9A-Za-z]{1,16}$/)],
    }),
    installedAt: new FormControl('', {
      nonNullable: true,
      validators: (control) => {
        const value: unknown = control.value;
        return value === '' ||
          (typeof value === 'string' && this.installedAtInstant(value) !== null)
          ? null
          : { pattern: true };
      },
    }),
    simIccid: new FormControl('', {
      nonNullable: true,
      validators: patternValidator(/^\d{18,22}$/),
    }),
    vehicleId: new FormControl<string | null>(null),
    notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
  });
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const device = this.device();
    return device
      ? interpolate(this.text().editTitle, { imei: device.imei })
      : this.text().createTitle;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly modelOptions = computed(() =>
    this.models().map((model) => ({
      value: model,
      label: deviceModelLabel(this.language(), model),
    })),
  );
  protected readonly vehicleOptions = computed(() => [
    { id: null, name: this.text().notInstalled },
    ...this.vehicles(),
  ]);
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });

  constructor() {
    effect(() => {
      const device = this.value() ?? this.device();
      const value = this.value();
      const timeZone = this.timeZone();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          imei: device?.imei ?? '',
          model: device?.model ?? null,
          simIccid: device?.simIccid ?? '',
          vehicleId: device?.vehicleId ?? null,
          notes: device?.notes ?? '',
          serialNumber: value?.serialNumber ?? '',
          options: value?.options ?? [],
          firmwareVersion: value?.firmwareVersion ?? '',
          edataModule: value?.edataModule ?? '',
          simPhoneNumber: value?.simPhoneNumber ?? '',
          smsPassword: value?.smsPassword ?? '',
          installedAt: value?.installedAt
            ? (isoToZonedWallTime(value.installedAt, timeZone) ?? '')
            : '',
        });
      });
    });
    effect(() => {
      const errors = this.fieldErrors();
      if (Object.keys(errors).length) {
        afterNextRender(
          () => {
            this.focusInvalid();
          },
          { injector: this.injector },
        );
      }
    });
    lockWhileSaving(
      this.form,
      () => this.saving() || !this.canEdit(),
      () => {
        this.focusInvalid();
      },
    );
  }

  protected errorOf(name: DeviceField): string | null {
    this.events();
    const server = this.fieldErrors()[name];
    if (server) {
      return server;
    }
    const control = this.form.controls[name];
    if (!control.invalid || (!control.touched && !this.submitted)) {
      return null;
    }
    return validationMessage(control.errors, this.language());
  }

  protected describedBy(name: DeviceField): string {
    return `device-${name}-hint device-${name}-error`;
  }

  protected submit(): void {
    if (!this.canEdit() || this.saving()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusInvalid();
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      imei: value.imei.trim(),
      model: value.model ?? '',
      simIccid: value.simIccid.trim(),
      vehicleId: value.vehicleId,
      notes: value.notes.trim(),
      serialNumber: value.serialNumber.trim(),
      options: value.options,
      firmwareVersion: value.firmwareVersion.trim(),
      edataModule: value.edataModule.trim(),
      simPhoneNumber: value.simPhoneNumber.trim(),
      smsPassword: value.smsPassword.trim(),
      installedAt: this.installedAtInstant(value.installedAt) ?? '',
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.closeLink() !== null) {
      this.drawer().close();
      return;
    }
    if (await this.canLeave()) {
      this.closed.emit();
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  private installedAtInstant(wallTime: string): string | null {
    const candidates = zonedWallTimeInstants(wallTime, this.timeZone());
    const original = this.value()?.installedAt;
    const originalAt = original ? Date.parse(original) : Number.NaN;
    // An unchanged repeated wall time must retain its original occurrence and precision.
    const selected = candidates.includes(originalAt) ? originalAt : candidates[0];
    return selected === undefined ? null : new Date(selected).toISOString();
  }

  private focusInvalid(): void {
    const element = this.formElement()?.nativeElement;
    if (!element || !focusFirstInvalid(element, fieldOrder, 'device-')) {
      this.drawer().keepFocusInside();
    }
  }
}
