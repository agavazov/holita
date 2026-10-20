import { DOCUMENT } from '@angular/common';
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
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tag } from 'primeng/tag';
import { confirmDialogPt, confirmDiscard } from '../../../ui/confirm';
import { FormField } from '../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import { EmptyState } from '../../../ui/empty-state/empty-state';
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
const fieldOrder: readonly GeneralSettingsField[] = [
  'name',
  'timeZone',
  'distanceUnit',
  'volumeUnit',
  ...numberFields,
];
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
    ConfirmDialog,
    InputNumber,
    InputText,
    Message,
    Select,
    ToggleSwitch,
    Tag,
    FormField,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './general-settings-view.html',
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class GeneralSettingsView {
  readonly demo = input(false);
  readonly notificationsUnavailable = input(false);
  readonly branchName = input.required<string>();
  readonly settings = input<GeneralSettings | null>(null);
  readonly state = input<'loading' | 'error' | 'ready'>('ready');
  readonly loadError = input<string | null>(null);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  /** Update the persisted baseline without replacing a failed, editable draft. */
  readonly retainDraft = input(false);
  readonly fieldErrors = input<Partial<Record<GeneralSettingsField, string>>>({});
  readonly save = output<GeneralSettings>();
  readonly discarded = output();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly header = viewChild.required(PageHeader);
  private readonly confirmation = inject(ConfirmationService);
  private pendingLeave: Promise<boolean> | null = null;
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly catalog = computed(() => settingsText(this.language()));
  protected readonly eyebrow = computed(() => this.catalog().eyebrow);
  protected readonly text = computed(() => this.catalog().general);
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
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
    lowFuelPct: new FormControl<number | null>(null, integerValidator(1, 50, { required: true })),
    notReportingHours: new FormControl<number | null>(
      null,
      integerValidator(1, 168, { required: true }),
    ),
    speedLimitKph: new FormControl<number | null>(
      null,
      integerValidator(30, 130, { required: true }),
    ),
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
  protected readonly selectPt = computed(() => ({
    timeZone: {
      label: {
        'aria-invalid': this.errorOf('timeZone') ? 'true' : undefined,
        'aria-describedby': 'settings-timeZone-hint settings-timeZone-error',
      },
    },
    distanceUnit: {
      label: {
        'aria-invalid': this.errorOf('distanceUnit') ? 'true' : undefined,
        'aria-describedby': 'settings-distanceUnit-hint settings-distanceUnit-error',
      },
    },
    volumeUnit: {
      label: {
        'aria-invalid': this.errorOf('volumeUnit') ? 'true' : undefined,
        'aria-describedby': 'settings-volumeUnit-hint settings-volumeUnit-error',
      },
    },
  }));

  constructor() {
    effect(() => {
      const settings = this.settings();
      if (settings && !this.retainDraft()) {
        untracked(() => {
          this.reset(settings);
        });
      }
    });
    let locked = false;
    effect(() => {
      const busy = this.saving() || this.state() !== 'ready';
      const unavailable = this.notificationsUnavailable();
      untracked(() => {
        if (busy) {
          this.form.disable();
        } else {
          if (locked) {
            this.form.enable();
          }
          for (const name of ['criticalAlerts', 'dailySummary', 'documentReminders'] as const) {
            const control = this.form.controls[name];
            if (unavailable) {
              control.disable();
            } else {
              control.enable();
            }
          }
          if (locked) {
            afterNextRender(
              () => {
                if (
                  !focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'settings-') &&
                  (!this.document.activeElement ||
                    this.document.activeElement === this.document.body)
                ) {
                  this.header().focusTitle();
                }
              },
              { injector: this.injector },
            );
          }
        }
        locked = busy;
      });
    });
    effect(() => {
      if (this.state() !== 'ready' || !Object.keys(this.fieldErrors()).length) {
        return;
      }
      afterNextRender(
        () => {
          if (this.state() === 'ready') {
            focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'settings-');
          }
        },
        { injector: this.injector },
      );
    });
  }

  protected errorOf(name: GeneralSettingsField): string | null {
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

  canLeave(): boolean | Promise<boolean> {
    if (this.saving()) {
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

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.saving()) {
      event.preventDefault();
    }
  }

  protected discard(): void {
    if (this.saving()) {
      return;
    }
    const settings = this.settings();
    if (settings) {
      this.reset(settings);
    }
    this.discarded.emit();
    this.header().focusTitle();
  }

  protected submit(): void {
    if (this.saving() || this.state() !== 'ready' || !this.settings()) {
      return;
    }
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
