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
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import { lockWhileSaving } from '../../../ui/forms/saving';
import {
  integerValidator,
  patternValidator,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { vehiclesText } from './i18n/messages';
import {
  type VehicleOption,
  vehicleStatuses,
  type VehicleStatusCode,
  vehicleTypes,
  type VehicleTypeCode,
} from './vehicles-view';

export const vehicleFuelTypes = ['DIESEL', 'PETROL', 'ELECTRIC', 'LPG', 'CNG', 'HYBRID'] as const;
export type VehicleFuelType = (typeof vehicleFuelTypes)[number];

/** The editable vehicle fields, as the create and update mutations take them. */
export interface VehicleForm {
  readonly plate: string;
  readonly fleetNumber: string;
  readonly vin: string;
  readonly type: VehicleTypeCode | null;
  readonly make: string;
  readonly model: string;
  readonly year: number | null;
  readonly fuelType: VehicleFuelType | null;
  readonly tankL: number | null;
  readonly status: VehicleStatusCode;
  readonly groupId: string | null;
  readonly driverId: string | null;
  readonly notes: string;
}

export type VehicleField = keyof VehicleForm;

const fieldOrder: readonly VehicleField[] = [
  'plate',
  'fleetNumber',
  'vin',
  'type',
  'make',
  'model',
  'year',
  'fuelType',
  'tankL',
  'status',
  'groupId',
  'driverId',
  'notes',
];

const emptyVehicle: VehicleForm = {
  plate: '',
  fleetNumber: '',
  vin: '',
  type: null,
  make: '',
  model: '',
  year: null,
  fuelType: null,
  tankL: null,
  status: 'ACTIVE',
  groupId: null,
  driverId: null,
  notes: '',
};

/**
 * Create or edit a vehicle in the right-hand drawer (the row opens straight into the form).
 * Presentation only: the host saves and passes back `saving`, `saveError` and server `fieldErrors`.
 */
@Component({
  selector: 'holita-vehicle-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputNumber,
    InputText,
    Message,
    Select,
    Textarea,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './vehicle-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleDrawer {
  /** The vehicle to edit; null creates a new one. */
  readonly vehicle = input<VehicleForm | null>(null);
  readonly groups = input<readonly VehicleOption[]>([]);
  readonly drivers = input<readonly VehicleOption[]>([]);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<VehicleField, string>>>({});
  readonly save = output<VehicleForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => vehiclesText(this.language()).drawer);
  private readonly labels = computed(() => vehiclesText(this.language()));

  protected readonly form = new FormGroup({
    plate: new FormControl('', {
      nonNullable: true,
      validators: textValidator(32, { required: true }),
    }),
    fleetNumber: new FormControl('', { nonNullable: true, validators: textValidator(16) }),
    vin: new FormControl('', {
      nonNullable: true,
      validators: patternValidator(/^[A-HJ-NPR-Z0-9]{17}$/, { transform: 'upper' }),
    }),
    type: new FormControl<VehicleTypeCode | null>(null),
    make: new FormControl('', {
      nonNullable: true,
      validators: textValidator(64),
    }),
    model: new FormControl('', {
      nonNullable: true,
      validators: textValidator(64),
    }),
    year: new FormControl<number | null>(null, integerValidator(1950, 2100)),
    fuelType: new FormControl<VehicleFuelType | null>(null),
    tankL: new FormControl<number | null>(null, integerValidator(1, 2000)),
    status: new FormControl<VehicleStatusCode>('ACTIVE', { nonNullable: true }),
    groupId: new FormControl<string | null>(null),
    driverId: new FormControl<string | null>(null),
    notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
  });
  /** Re-reads errors and the dirty state whenever the form reports a change. */
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const vehicle = this.vehicle();
    return vehicle
      ? interpolate(this.text().editTitle, { plate: vehicle.plate })
      : this.text().createTitle;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly typeOptions = computed(() => [
    { value: null, label: this.text().none },
    ...vehicleTypes.map((value) => ({ value, label: this.labels().types[value] })),
  ]);
  protected readonly fuelOptions = computed(() => [
    { value: null, label: this.text().none },
    ...vehicleFuelTypes.map((value) => ({ value, label: this.labels().fuelTypes[value] })),
  ]);
  protected readonly statusOptions = computed(() =>
    vehicleStatuses.map((value) => ({ value, label: this.labels().statuses[value] })),
  );
  protected readonly groupOptions = computed(() => [
    { id: null, name: this.text().none },
    ...this.groups(),
  ]);
  protected readonly driverOptions = computed(() => [
    { id: null, name: this.text().none },
    ...this.drivers(),
  ]);
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });
  protected readonly numberPt = computed(() => ({
    year: innerInputPt('vehicle-year', !!this.errorOf('year')),
    tankL: innerInputPt('vehicle-tankL', !!this.errorOf('tankL')),
  }));

  constructor() {
    effect(() => {
      const vehicle = this.vehicle() ?? emptyVehicle;
      untracked(() => {
        this.submitted = false;
        this.form.reset({ ...vehicle });
      });
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        if (!focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'vehicle-')) {
          this.drawer().keepFocusInside();
        }
      },
    );
  }

  /** The message under a field: the server's error first, then the client check once shown. */
  protected errorOf(name: VehicleField): string | null {
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

  protected describedBy(name: VehicleField): string {
    return `vehicle-${name}-hint vehicle-${name}-error`;
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'vehicle-');
        },
        { injector: this.injector },
      );
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({
      ...value,
      plate: value.plate.trim(),
      fleetNumber: value.fleetNumber.trim(),
      vin: value.vin.trim().toUpperCase(),
      make: value.make.trim(),
      model: value.model.trim(),
      notes: value.notes.trim(),
    });
  }

  /** Close button, Escape, backdrop and Cancel: unsaved changes are confirmed first. */
  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected async requestClose(): Promise<void> {
    if (await this.canLeave()) {
      this.closed.emit();
    }
  }
}
