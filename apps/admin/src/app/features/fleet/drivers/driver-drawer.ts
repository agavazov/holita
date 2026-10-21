import { RouterLink } from '@angular/router';
import type { FleetRecordLinks } from '../fleet-record-links';
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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import {
  FormatDateOnlyPipe,
  FormatDateTimePipe,
  FormatNumberPipe,
} from '../../../ui/format/format.pipes';
import { fromDateOnly, toDateOnly } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { datePickerInputPt } from '../../../ui/forms/inner-input-pt';
import { lockWhileSaving } from '../../../ui/forms/saving';
import {
  dateOnlyValidator,
  patternValidator,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { selectMultiplePt } from '../../../ui/select-multiple';
import {
  daysUntil,
  documentWarningDays,
  driverStatuses,
  driverLicenseCategories,
  type DriverLicenseCategory,
  type DriverStatusCode,
  scoreTone,
} from './drivers-view';
import { driversText } from './i18n/messages';

/** The editable driver fields, as the create and update mutations take them. */
export interface DriverForm {
  readonly firstName: string;
  readonly lastName: string;
  readonly employeeNo: string;
  readonly identificationKey: string;
  readonly phone: string;
  readonly email: string;
  readonly status: DriverStatusCode;
  readonly licenseNumber: string;
  readonly licenseCategories: readonly DriverLicenseCategory[];
  readonly licenseExpiresOn: string | null;
  readonly tachographCardNumber: string;
  readonly tachoCardExpiresOn: string | null;
  readonly notes: string;
}

/** The driver record shown read-only: the form fields plus assignment and driving data. */
export interface DriverDetails extends DriverForm {
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly vehiclePlate: string | null;
  readonly vehicles: readonly { readonly id: string; readonly plate: string }[];
  readonly score: number | null;
  readonly trips30d: number;
  readonly distance30dKm: number;
}

export type DriverField = keyof DriverForm;

const fieldOrder: readonly DriverField[] = [
  'firstName',
  'lastName',
  'employeeNo',
  'identificationKey',
  'phone',
  'email',
  'status',
  'licenseNumber',
  'licenseCategories',
  'licenseExpiresOn',
  'tachographCardNumber',
  'tachoCardExpiresOn',
  'notes',
];

const statusTones = { ACTIVE: 'success', ON_LEAVE: 'info', INACTIVE: 'neutral' } as const;

/**
 * The mixed drawer: a driver opens read-only and Edit switches the same drawer to the form;
 * Cancel returns to the record. A new driver opens straight into the form. Presentation only:
 * the host saves and passes back `saving`, `saveError` and server `fieldErrors`.
 */
@Component({
  selector: 'holita-driver-drawer',
  imports: [
    RouterLink,
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
    FormatDateTimePipe,
    FormatNumberPipe,
  ],
  templateUrl: './driver-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverDrawer {
  readonly recordLinks = input<FleetRecordLinks | null>(null);
  /** The driver to show; null creates a new one. */
  readonly driver = input<DriverDetails | null>(null);
  /** Opens an existing driver on the form (the row's Edit action) instead of the record. */
  readonly startEditing = input(false);
  readonly businessDate = input.required<string | null>();
  readonly saving = input(false);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  /** Routed hosts own Edit/Cancel navigation; stories keep the local mixed-drawer behavior. */
  readonly routed = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<DriverField, string>>>({});
  readonly save = output<DriverForm>();
  readonly closed = output();
  readonly openScorecard = output();
  readonly openVehicle = output<string>();
  readonly editRequest = output();
  readonly cancelEdit = output();
  readonly retry = output();

  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly catalog = computed(() => driversText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);

  /** A new record, or a saved one reopening, decides between the record and the form. */
  protected readonly editing = linkedSignal(() => this.driver() === null || this.startEditing());

  protected readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: textValidator(64, { required: true }),
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: textValidator(64, { required: true }),
    }),
    employeeNo: new FormControl('', {
      nonNullable: true,
      validators: textValidator(32),
    }),
    identificationKey: new FormControl('', { nonNullable: true, validators: textValidator(32) }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(20), patternValidator(/^\+?[0-9 ]{6,20}$/)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254), patternValidator(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)],
    }),
    status: new FormControl<DriverStatusCode>('ACTIVE', { nonNullable: true }),
    licenseNumber: new FormControl('', { nonNullable: true, validators: textValidator(32) }),
    licenseCategories: new FormControl<DriverLicenseCategory[]>([], { nonNullable: true }),
    licenseExpiresOn: new FormControl<Date | null>(
      null,
      dateOnlyValidator('1900-01-01', '2100-12-31'),
    ),
    tachographCardNumber: new FormControl('', { nonNullable: true, validators: textValidator(16) }),
    tachoCardExpiresOn: new FormControl<Date | null>(
      null,
      dateOnlyValidator('1900-01-01', '2100-12-31'),
    ),
    notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
  });
  /** Re-reads errors and the dirty state whenever the form reports a change. */
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    if (this.state() !== 'ready') {
      return this.text().recordTitle;
    }
    const driver = this.driver();
    if (!driver) {
      return this.text().createTitle;
    }
    return this.editing() ? interpolate(this.text().editTitle, { name: driver.name }) : driver.name;
  });
  protected readonly subtitle = computed(() => {
    const driver = this.driver();
    if (!driver) {
      return null;
    }
    return [driver.employeeNo, driver.vehiclePlate].filter(Boolean).join(' · ');
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.editing() && this.form.dirty;
  });
  protected readonly statusOptions = computed(() =>
    driverStatuses.map((value) => ({ value, label: this.catalog().statuses[value] })),
  );
  protected readonly categoryOptions = driverLicenseCategories.map((value) => ({
    value,
    label: value,
  }));
  protected readonly categoryPt = selectMultiplePt;
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });
  protected readonly datePt = computed(() => ({
    licenseExpiresOn: datePickerInputPt(
      'driver-licenseExpiresOn',
      !!this.errorOf('licenseExpiresOn'),
    ),
    tachoCardExpiresOn: datePickerInputPt(
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
    effect(() => {
      const errors = this.fieldErrors();
      if (this.state() !== 'ready' || !Object.keys(errors).length) {
        return;
      }
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (this.state() === 'ready' && form?.isConnected) {
            focusFirstInvalid(form, fieldOrder, 'driver-');
          }
        },
        { injector: this.injector },
      );
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        const form = this.formElement()?.nativeElement;
        if (!form || !focusFirstInvalid(form, fieldOrder, 'driver-')) {
          this.drawer().keepFocusInside();
        }
      },
    );
  }

  protected statusSeverity(status: DriverStatusCode) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: DriverStatusCode): string {
    return this.catalog().statuses[status];
  }

  protected expiry(dateOnly: string | null): { severity: 'danger' | 'warn'; label: string } | null {
    const today = this.businessDate();
    if (dateOnly === null || today === null) {
      return null;
    }
    const days = daysUntil(dateOnly, today);
    if (days < 0) {
      return { severity: 'danger', label: this.catalog().expiry.expired };
    }
    if (days <= documentWarningDays) {
      return { severity: 'warn', label: interpolate(this.catalog().expiry.soon, { days }) };
    }
    return null;
  }

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  /** The message under a field: the server's error first, then the client check once shown. */
  protected errorOf(name: DriverField): string | null {
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

  protected describedBy(name: DriverField): string {
    return `driver-${name}-hint driver-${name}-error`;
  }

  protected edit(): void {
    if (this.routed()) {
      this.editRequest.emit();
      return;
    }
    this.editing.set(true);
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, fieldOrder, 'driver-');
          }
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      ...value,
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      employeeNo: value.employeeNo.trim(),
      identificationKey: value.identificationKey.trim(),
      phone: value.phone.trim(),
      email: value.email.trim(),
      licenseNumber: value.licenseNumber.trim(),
      licenseExpiresOn: value.licenseExpiresOn ? toDateOnly(value.licenseExpiresOn) : null,
      tachographCardNumber: value.tachographCardNumber.trim(),
      tachoCardExpiresOn: value.tachoCardExpiresOn ? toDateOnly(value.tachoCardExpiresOn) : null,
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
    if (this.routed()) {
      this.cancelEdit.emit();
      return;
    }
    if (!(await this.drawer().confirmLeave(this.form.dirty))) {
      return;
    }
    this.reset(driver);
    this.editing.set(false);
  }

  /** Close button, Escape and backdrop: unsaved changes are confirmed first. */
  protected async requestClose(): Promise<void> {
    if (this.closeLink() !== null) {
      this.drawer().close();
      return;
    }
    if (await this.canLeave()) {
      this.closed.emit();
    }
  }

  canLeave(): Promise<boolean> | boolean {
    return this.saving() ? false : this.drawer().confirmLeave(this.dirty());
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  private reset(driver: DriverDetails | null): void {
    this.submitted = false;
    this.form.reset({
      firstName: driver?.firstName ?? '',
      lastName: driver?.lastName ?? '',
      employeeNo: driver?.employeeNo ?? '',
      identificationKey: driver?.identificationKey ?? '',
      phone: driver?.phone ?? '',
      email: driver?.email ?? '',
      status: driver?.status ?? 'ACTIVE',
      licenseNumber: driver?.licenseNumber ?? '',
      licenseCategories: [...(driver?.licenseCategories ?? [])],
      licenseExpiresOn: fromDateOnly(driver?.licenseExpiresOn),
      tachographCardNumber: driver?.tachographCardNumber ?? '',
      tachoCardExpiresOn: fromDateOnly(driver?.tachoCardExpiresOn),
      notes: driver?.notes ?? '',
    });
  }
}
