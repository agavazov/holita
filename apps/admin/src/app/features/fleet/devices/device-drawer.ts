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
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatNumberPipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { focusFirstInvalid } from '../../../ui/forms/focus';
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
}

export type DeviceField = keyof DeviceForm;

const fieldOrder: readonly DeviceField[] = ['imei', 'model', 'simIccid', 'vehicleId', 'notes'];

const required = (control: { value: unknown }) => (control.value ? null : { required: true });

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
  /** The device to edit; null registers a new one. */
  readonly device = input<DeviceRow | null>(null);
  readonly models = input<readonly string[]>([]);
  readonly vehicles = input<readonly { readonly id: string; readonly name: string }[]>([]);
  readonly dataAsOf = input.required<string>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<DeviceField, string>>>({});
  readonly save = output<DeviceForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly catalog = computed(() => devicesText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);

  protected readonly form = new FormGroup({
    imei: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(15, { required: true }), patternValidator(/^\d{15}$/)],
    }),
    model: new FormControl<string | null>(null, required),
    simIccid: new FormControl('', {
      nonNullable: true,
      validators: patternValidator(/^\d{19,20}$/),
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
      const device = this.device();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          imei: device?.imei ?? '',
          model: device?.model ?? null,
          simIccid: device?.simIccid ?? '',
          vehicleId: device?.vehicleId ?? null,
          notes: device?.notes ?? '',
        });
      });
    });
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
    if (server) return server;
    const control = this.form.controls[name];
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    return validationMessage(control.errors, this.language());
  }

  protected describedBy(name: DeviceField): string {
    return `device-${name}-hint device-${name}-error`;
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.model) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'device-');
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      imei: value.imei.trim(),
      model: value.model,
      simIccid: value.simIccid.trim(),
      vehicleId: value.vehicleId,
      notes: value.notes.trim(),
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (await this.drawer().confirmLeave(this.form.dirty)) this.closed.emit();
  }
}
