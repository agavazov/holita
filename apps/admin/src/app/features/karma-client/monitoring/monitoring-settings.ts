import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { UpdateFleetKarmaMonitoringSettingsInput } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { confirmDialogPt, confirmDiscard } from '../../../ui/confirm';
import { FormField } from '../../../ui/form-field/form-field';
import { fieldErrors } from '../../../ui/forms/field-errors';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import { integerValidator, validationMessage } from '../../../ui/forms/validators';
import { PageHeader } from '../../../ui/page-header/page-header';
import { MonitoringApi } from './monitoring-api';
import { monitoringText } from './monitoring-text';

const numberFields = [
  { key: 'statusPollSeconds', min: 30, max: 3600 },
  { key: 'offlineAfterMinutes', min: 2, max: 1440 },
  { key: 'faultHistoryPollMinutes', min: 5, max: 1440 },
  { key: 'faultCommandMinutes', min: 15, max: 1440 },
  { key: 'retentionDays', min: 1, max: 30 },
] as const;
const fields = [
  'enabled',
  'faultCommandEnabled',
  ...numberFields.map((field) => field.key),
] as const;
type Field = (typeof fields)[number];
function numeric(value: number, min: number, max: number) {
  return new FormControl(value, {
    nonNullable: true,
    validators: integerValidator(min, max, { required: true }),
  });
}

@Component({
  selector: 'holita-karma-monitoring-settings',
  imports: [
    PageHeader,
    FormField,
    ReactiveFormsModule,
    InputNumber,
    ToggleSwitch,
    Message,
    ButtonDirective,
    RouterLink,
    ConfirmDialog,
  ],
  providers: [MonitoringApi, ConfirmationService],
  templateUrl: './monitoring-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class MonitoringSettings implements OnInit {
  readonly branchId = input.required<string>();
  readonly branchName = input.required<string>();
  readonly language = input.required<Language>();
  private readonly api = inject(MonitoringApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notices = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly element = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => monitoringText(this.language()));
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
  protected readonly settings = signal<UpdateFleetKarmaMonitoringSettingsInput | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<unknown>(null);
  protected readonly saveError = signal<unknown>(null);
  protected readonly saving = signal(false);
  protected readonly numbers = numberFields;
  protected readonly toggles = ['enabled', 'faultCommandEnabled'] as const;
  protected readonly form = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    statusPollSeconds: numeric(60, 30, 3600),
    offlineAfterMinutes: numeric(15, 2, 1440),
    faultHistoryPollMinutes: numeric(60, 5, 1440),
    faultCommandEnabled: new FormControl(true, { nonNullable: true }),
    faultCommandMinutes: numeric(60, 15, 1440),
    retentionDays: numeric(10, 1, 30),
  });
  private readonly formEvents = toSignal(this.form.events);
  protected readonly serverErrors = computed(() =>
    fieldErrors(this.saveError(), fields, this.language()),
  );
  protected readonly failure = computed(() => requestError(this.error(), this.text().loadError));
  protected readonly saveFailure = computed(() =>
    requestError(this.saveError(), this.text().saveError),
  );
  protected readonly commandHint = computed(() => {
    this.formEvents();
    return this.text().commandHint.replace(
      '{minutes}',
      this.form.controls.faultCommandMinutes.valid
        ? String(this.form.controls.faultCommandMinutes.value)
        : '—',
    );
  });
  protected readonly dirty = computed(() => {
    this.formEvents();
    return this.form.dirty;
  });
  protected readonly inputPt = innerInputPt;
  private pendingLeave: Promise<boolean> | null = null;

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .settings()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.settings.set(result.data.fleetKarmaMonitoringSettings);
            this.discard();
          }
        },
        error: (error: unknown) => {
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }
  protected errorOf(field: Field): string | null {
    this.formEvents();
    const control = this.form.controls[field];
    return (
      this.serverErrors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }
  protected discard(): void {
    const settings = this.settings();
    if (settings) {
      this.form.reset({
        enabled: settings.enabled,
        statusPollSeconds: settings.statusPollSeconds,
        offlineAfterMinutes: settings.offlineAfterMinutes,
        faultHistoryPollMinutes: settings.faultHistoryPollMinutes,
        faultCommandEnabled: settings.faultCommandEnabled,
        faultCommandMinutes: settings.faultCommandMinutes,
        retentionDays: settings.retentionDays,
      });
    }
    this.saveError.set(null);
  }
  protected async save(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(null);
    if (this.form.invalid) {
      const element = this.element();
      if (element) {
        focusFirstInvalid(element.nativeElement, fields, 'monitoring-');
      }
      return;
    }
    this.saving.set(true);
    const input = this.form.getRawValue();
    this.form.disable();
    try {
      const result = await this.api.save(input);
      if (this.destroyRef.destroyed) {
        return;
      }
      this.settings.set(result);
      this.discard();
      this.notices.add({ severity: 'success', summary: this.text().saved, life: 5000 });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.saveError.set(error);
        this.notices.add({
          severity: 'error',
          summary: this.text().saveError,
          detail: requestError(error, this.text().retrySave),
          sticky: true,
        });
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.saving.set(false);
        this.form.enable();
      }
    }
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
}
