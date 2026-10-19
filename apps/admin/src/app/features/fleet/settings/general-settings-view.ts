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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FormField } from '../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import { integerValidator, textValidator, validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { PageHeader } from '../../../ui/page-header/page-header';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { settingsText } from './i18n/messages';

export interface GeneralSettings {
  readonly name: string;
  readonly timeZone: string;
  readonly distanceUnit: 'km' | 'mi';
  readonly volumeUnit: 'l' | 'gal';
  readonly lowFuelPct: number;
  readonly notReportingHours: number;
  readonly speedLimitKph: number;
  readonly criticalAlerts: boolean;
  readonly dailySummary: boolean;
  readonly documentReminders: boolean;
}

export type GeneralSettingsField = keyof GeneralSettings;

const numberFields = ['lowFuelPct', 'notReportingHours', 'speedLimitKph'] as const;
const fieldOrder: readonly GeneralSettingsField[] = ['name', ...numberFields];
const timeZones = ['Europe/Sofia', 'Europe/Bucharest', 'Europe/Athens', 'Europe/Belgrade'];

/**
 * A settings page form: titled cards with their fields, and a save bar that sticks to the bottom
 * while there are changes. Presentation only: the host saves and passes back the stored values.
 */
@Component({
  selector: 'holita-general-settings-view',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputNumber,
    InputText,
    Message,
    Select,
    ToggleSwitch,
    FormField,
    PageHeader,
  ],
  templateUrl: './general-settings-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class GeneralSettingsView {
  readonly branchName = input.required<string>();
  readonly settings = input.required<GeneralSettings>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly save = output<GeneralSettings>();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly catalog = computed(() => settingsText(this.language()));
  protected readonly eyebrow = computed(() => this.catalog().eyebrow);
  protected readonly text = computed(() => this.catalog().general);
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly timeZones = timeZones.map((zone) => ({ value: zone, label: zone }));
  protected readonly distanceUnits = computed(() => [
    { value: 'km', label: this.text().kilometres },
    { value: 'mi', label: this.text().miles },
  ]);
  protected readonly volumeUnits = computed(() => [
    { value: 'l', label: this.text().litres },
    { value: 'gal', label: this.text().gallons },
  ]);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: textValidator(80, { required: true }),
    }),
    timeZone: new FormControl('Europe/Sofia', { nonNullable: true }),
    distanceUnit: new FormControl<'km' | 'mi'>('km', { nonNullable: true }),
    volumeUnit: new FormControl<'l' | 'gal'>('l', { nonNullable: true }),
    lowFuelPct: new FormControl<number | null>(null, integerValidator(1, 50)),
    notReportingHours: new FormControl<number | null>(null, integerValidator(1, 168)),
    speedLimitKph: new FormControl<number | null>(null, integerValidator(30, 130)),
    criticalAlerts: new FormControl(true, { nonNullable: true }),
    dailySummary: new FormControl(false, { nonNullable: true }),
    documentReminders: new FormControl(true, { nonNullable: true }),
  });
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly numberPt = computed(() => ({
    lowFuelPct: innerInputPt('settings-lowFuelPct', !!this.errorOf('lowFuelPct')),
    notReportingHours: innerInputPt(
      'settings-notReportingHours',
      !!this.errorOf('notReportingHours'),
    ),
    speedLimitKph: innerInputPt('settings-speedLimitKph', !!this.errorOf('speedLimitKph')),
  }));

  constructor() {
    effect(() => {
      const settings = this.settings();
      untracked(() => {
        this.reset(settings);
      });
    });
  }

  protected errorOf(name: GeneralSettingsField): string | null {
    this.events();
    const control = this.form.controls[name];
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    return validationMessage(control.errors, this.language());
  }

  protected discard(): void {
    this.reset(this.settings());
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const { lowFuelPct, notReportingHours, speedLimitKph } = value;
    if (
      this.form.invalid ||
      lowFuelPct === null ||
      notReportingHours === null ||
      speedLimitKph === null
    ) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'settings-');
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      ...value,
      name: value.name.trim(),
      lowFuelPct,
      notReportingHours,
      speedLimitKph,
    });
  }

  private reset(settings: GeneralSettings): void {
    this.submitted = false;
    this.form.reset({ ...settings });
  }
}
