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
  linkedSignal,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateOnlyPipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { fromDateOnly, toDateOnly } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import {
  dateOnlyValidator,
  patternValidator,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  daysUntil,
  documentWarningDays,
  driverStatuses,
  type DriverStatusCode,
  scoreTone,
} from './drivers-view';
import { driversText } from './i18n/messages';

/** The editable driver fields, as the create and update mutations take them. */
export interface DriverForm {
  readonly name: string;
  readonly employeeNo: string;
  readonly phone: string;
  readonly email: string;
  readonly status: DriverStatusCode;
  readonly licenseExpiresOn: string;
  readonly tachoCardExpiresOn: string;
  readonly notes: string;
}

/** The driver record shown read-only: the form fields plus assignment and driving data. */
export interface DriverDetails extends DriverForm {
  readonly vehiclePlate: string | null;
  readonly score: number | null;
  readonly trips30d: number;
  readonly distance30dKm: number;
}

export type DriverField = keyof DriverForm;

const fieldOrder: readonly DriverField[] = [
  'name',
  'employeeNo',
  'phone',
  'email',
  'status',
  'licenseExpiresOn',
  'tachoCardExpiresOn',
  'notes',
];

const statusTones = { ACTIVE: 'success', ON_LEAVE: 'info', INACTIVE: 'neutral' } as const;

const required: ValidatorFn = (control) => Validators.required(control);

/**
 * The mixed drawer: a driver opens read-only and Edit switches the same drawer to the form;
 * Cancel returns to the record. A new driver opens straight into the form. Presentation only:
 * the host saves and passes back `saving`, `saveError` and server `fieldErrors`.
 */
@Component({
  selector: 'holita-driver-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    InputText,
    Message,
    Select,
    Tag,
    Textarea,
    RouteDrawer,
    FormField,
    FormatDateOnlyPipe,
    FormatNumberPipe,
  ],
  templateUrl: './driver-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverDrawer {
  /** The driver to show; null creates a new one. */
  readonly driver = input<DriverDetails | null>(null);
  /** Opens an existing driver on the form (the row's Edit action) instead of the record. */
  readonly startEditing = input(false);
  readonly dataAsOf = input.required<string>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<DriverField, string>>>({});
  readonly save = output<DriverForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  private readonly catalog = computed(() => driversText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);

  /** A new record, or a saved one reopening, decides between the record and the form. */
  protected readonly editing = linkedSignal(() => this.driver() === null || this.startEditing());

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: textValidator(80, { required: true }),
    }),
    employeeNo: new FormControl('', {
      nonNullable: true,
      validators: textValidator(16, { required: true }),
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(32), patternValidator(/^\+?[0-9 ]{6,20}$/)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(120), patternValidator(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)],
    }),
    status: new FormControl<DriverStatusCode>('ACTIVE', { nonNullable: true }),
    licenseExpiresOn: new FormControl<Date | null>(null, [required, dateOnlyValidator(null, null)]),
    tachoCardExpiresOn: new FormControl<Date | null>(null, [
      required,
      dateOnlyValidator(null, null),
    ]),
    notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
  });
  /** Re-reads errors and the dirty state whenever the form reports a change. */
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const driver = this.driver();
    if (!driver) return this.text().createTitle;
    return this.editing() ? interpolate(this.text().editTitle, { name: driver.name }) : driver.name;
  });
  protected readonly subtitle = computed(() => {
    const driver = this.driver();
    if (!driver) return null;
    return [driver.employeeNo, driver.vehiclePlate].filter(Boolean).join(' · ');
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.editing() && this.form.dirty;
  });
  protected readonly statusOptions = computed(() =>
    driverStatuses.map((value) => ({ value, label: this.catalog().statuses[value] })),
  );
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });
  protected readonly datePt = computed(() => ({
    licenseExpiresOn: innerInputPt('driver-licenseExpiresOn', !!this.errorOf('licenseExpiresOn')),
    tachoCardExpiresOn: innerInputPt(
      'driver-tachoCardExpiresOn',
      !!this.errorOf('tachoCardExpiresOn'),
    ),
  }));

  constructor() {
    effect(() => {
      const driver = this.driver();
      untracked(() => {
        this.reset(driver);
      });
    });
  }

  protected statusSeverity(status: DriverStatusCode) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: DriverStatusCode): string {
    return this.catalog().statuses[status];
  }

  protected expiry(dateOnly: string): { severity: 'danger' | 'warn'; label: string } | null {
    const days = daysUntil(dateOnly, this.dataAsOf());
    if (days < 0) return { severity: 'danger', label: this.catalog().expiry.expired };
    if (days <= documentWarningDays)
      return { severity: 'warn', label: interpolate(this.catalog().expiry.soon, { days }) };
    return null;
  }

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  /** The message under a field: the server's error first, then the client check once shown. */
  protected errorOf(name: DriverField): string | null {
    this.events();
    const server = this.fieldErrors()[name];
    if (server) return server;
    const control = this.form.controls[name];
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    return validationMessage(control.errors, this.language());
  }

  protected describedBy(name: DriverField): string {
    return `driver-${name}-hint driver-${name}-error`;
  }

  protected edit(): void {
    this.editing.set(true);
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.licenseExpiresOn || !value.tachoCardExpiresOn) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) focusFirstInvalid(form, fieldOrder, 'driver-');
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      ...value,
      name: value.name.trim(),
      employeeNo: value.employeeNo.trim(),
      phone: value.phone.trim(),
      email: value.email.trim(),
      licenseExpiresOn: toDateOnly(value.licenseExpiresOn),
      tachoCardExpiresOn: toDateOnly(value.tachoCardExpiresOn),
      notes: value.notes.trim(),
    });
  }

  /** Cancel: an existing driver returns to the record, a new one closes the drawer. */
  protected async cancel(): Promise<void> {
    const driver = this.driver();
    if (!driver) {
      await this.requestClose();
      return;
    }
    if (!(await this.drawer().confirmLeave(this.form.dirty))) return;
    this.reset(driver);
    this.editing.set(false);
  }

  /** Close button, Escape and backdrop: unsaved changes are confirmed first. */
  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (await this.drawer().confirmLeave(this.dirty())) this.closed.emit();
  }

  private reset(driver: DriverDetails | null): void {
    this.submitted = false;
    this.form.reset({
      name: driver?.name ?? '',
      employeeNo: driver?.employeeNo ?? '',
      phone: driver?.phone ?? '',
      email: driver?.email ?? '',
      status: driver?.status ?? 'ACTIVE',
      licenseExpiresOn: fromDateOnly(driver?.licenseExpiresOn),
      tachoCardExpiresOn: fromDateOnly(driver?.tachoCardExpiresOn),
      notes: driver?.notes ?? '',
    });
  }
}
