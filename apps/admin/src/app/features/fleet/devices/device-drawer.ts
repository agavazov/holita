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
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { selectMultiplePt } from '../../../ui/select-multiple';
import { deviceOptions } from './device-query';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatNumberPipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { lockWhileSaving } from '../../../ui/forms/saving';
import { patternValidator, textValidator, validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { type DeviceRow, deviceStatusTones } from './devices-view';
import { devicesText } from './i18n/messages';

/** The editable device fields, as the register and update mutations take them. */
export interface DeviceForm {
  readonly imei: string;
  readonly model: string;
  readonly simIccid: string;
  readonly vehicleId: string | null;
  readonly notes: string;
  readonly options?: readonly string[];
  readonly firmwareVersion?: string;
  readonly simPhoneNumber?: string;
  readonly installedAt?: string;
}

export type DeviceField = keyof DeviceForm;

const fieldOrder: readonly DeviceField[] = [
  'imei',
  'model',
  'options',
  'simIccid',
  'simPhoneNumber',
  'firmwareVersion',
  'installedAt',
  'vehicleId',
  'notes',
];

/**
 * Direct edit with read-only context: the device's live diagnostics sit above the installation
 * form, so the user sees what they change. A new device opens on the form only.
 */
@Component({
  selector: 'holita-device-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Message,
    Select,
    Tag,
    Textarea,
    RouteDrawer,
    FormField,
    FormatNumberPipe,
    FormatRelativePipe,
  ],
  templateUrl: './device-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceDrawer {
  readonly demo = input(false);
  /** The device to edit; null registers a new one. */
  readonly device = input<DeviceRow | null>(null);
  readonly value = input<DeviceForm | null>(null);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly choicesError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  readonly models = input<readonly string[]>([]);
  readonly vehicles = input<readonly { readonly id: string; readonly name: string }[]>([]);
  readonly dataAsOf = input.required<string>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<DeviceField, string>>>({});
  readonly save = output<DeviceForm>();
  readonly closed = output();
  readonly retry = output();
  readonly retryChoices = output();

  private readonly language = inject(UI_LANGUAGE);
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
  protected readonly optionChoices = deviceOptions.map((value) => ({ value, label: value }));
  private readonly catalog = computed(() => devicesText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);

  protected readonly form = new FormGroup({
    imei: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(15, { required: true }), patternValidator(/^\d{15}$/)],
    }),
    model: new FormControl<string | null>(null, (control) =>
      this.demo() && !control.value ? { required: true } : null,
    ),
    options: new FormControl<readonly string[]>([], { nonNullable: true }),
    firmwareVersion: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(32), patternValidator(/^[0-9A-Za-z._-]{1,32}$/)],
    }),
    simPhoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(20), patternValidator(/^\+?[0-9]{6,19}$/)],
    }),
    installedAt: new FormControl('', {
      nonNullable: true,
      validators: patternValidator(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/,
      ),
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
    this.models().map((model) => ({ value: model, label: model })),
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
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          imei: device?.imei ?? '',
          model: device?.model ?? null,
          simIccid: device?.simIccid ?? '',
          vehicleId: device?.vehicleId ?? null,
          notes: device?.notes ?? '',
          options: value?.options ?? [],
          firmwareVersion: value?.firmwareVersion ?? '',
          simPhoneNumber: value?.simPhoneNumber ?? '',
          installedAt: value?.installedAt ?? '',
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
      () => this.saving(),
      () => {
        this.focusInvalid();
      },
    );
  }

  protected statusSeverity(device: DeviceRow) {
    return toneSeverity(deviceStatusTones[device.status]);
  }

  protected statusLabel(device: DeviceRow): string {
    return this.catalog().statuses[device.status];
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
    if (this.saving()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    this.form.controls.model.updateValueAndValidity();
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
      options: value.options,
      firmwareVersion: value.firmwareVersion.trim(),
      simPhoneNumber: value.simPhoneNumber.trim(),
      installedAt: value.installedAt.trim(),
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
    return this.saving() ? false : this.drawer().confirmLeave(this.form.dirty);
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  private focusInvalid(): void {
    const element = this.formElement()?.nativeElement;
    if (!element || !focusFirstInvalid(element, fieldOrder, 'device-')) {
      this.drawer().keepFocusInside();
    }
  }
}
