import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  UI_LANGUAGE,
  drawerRouteData,
  errorCode,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  requireOneOf,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { injectLeadRecord, leadLabel } from './lead-record';
import { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

const fieldNames = ['displayName', 'websiteUrl', 'sourceName'] as const;
type LeadField = (typeof fieldNames)[number];

const websiteValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  const url = typeof value === 'string' ? value.trim() : '';
  if (url && (!/^https?:\/\/[^/\s\\]/iu.test(url) || !URL.parse(url)?.hostname)) {
    return { website: true };
  }
  return null;
};

@Component({
  selector: 'holita-lead-editor',
  imports: [RouteDrawer, ReactiveFormsModule, FormField, InputText, ButtonDirective, Message],
  templateUrl: './lead-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadEditor {
  private readonly api = inject(LeadsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly parentParams = toSignal(this.route.parent?.paramMap ?? this.route.paramMap, {
    requireSync: true,
  });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() =>
    this.parentParams().get(this.routeData.recordParam ?? 'recordId'),
  );
  protected readonly entry = injectLeadRecord(this.id);
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.editing) {
      return 'ready';
    }
    if (!this.entry.validId()) {
      return 'invalid-id';
    }
    if (this.entry.record.isLoading()) {
      return 'loading';
    }
    if (this.entry.record.error()) {
      return 'error';
    }
    return this.entry.lead() ? 'ready' : 'not-found';
  });
  protected readonly subtitle = computed(() => {
    const lead = this.entry.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saveLabel = computed(() => operatorStrings[this.language()].save);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly errors = signal<Partial<Record<LeadField, string>>>({});
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      displayName: ['', textValidator(255)],
      websiteUrl: ['', [textValidator(2048), websiteValidator]],
      sourceName: ['', textValidator(255)],
    },
    { validators: requireOneOf('displayName', 'websiteUrl') },
  );

  constructor() {
    effect(() => {
      const lead = this.entry.lead();
      this.form.reset({
        displayName: lead?.displayName ?? '',
        websiteUrl: lead?.websiteUrl ?? '',
        sourceName: lead?.sourceName ?? '',
      });
      this.errors.set({});
      this.saveError.set(null);
    });
    lockWhileSaving(this.form, this.saving, () => {
      if (this.saveError() || Object.keys(this.errors()).length) {
        this.focusError();
      }
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected fieldError(field: LeadField): string | null {
    const control = this.form.controls[field];
    const error = this.errors()[field];
    if (error) {
      return error;
    }
    if (!control.touched) {
      return null;
    }
    if (control.hasError('requireOneOf')) {
      return this.text().leadIdentityRequired;
    }
    if (control.hasError('website')) {
      return this.text().leadInvalidWebsite;
    }
    return validationMessage(control.errors, this.language());
  }

  protected clearError(field: LeadField): void {
    this.errors.update((errors) => {
      if (field === 'websiteUrl') {
        const { websiteUrl: _website, displayName: _name, ...remaining } = errors;
        return remaining;
      }
      const { [field]: _error, ...remaining } = errors;
      return remaining;
    });
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(null);
    this.errors.set({});
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, this.form.getRawValue(), this.id());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().leadSaved, recordId: id });
      if (this.editing) {
        this.drawer().close();
      }
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fieldNames, scope.language, (code, field) => {
        if (code === 'IDENTITY_REQUIRED') {
          return this.text().leadIdentityRequired;
        }
        return field === 'websiteUrl' && code === 'INVALID_FORMAT'
          ? this.text().leadInvalidWebsite
          : undefined;
      });
      this.errors.set(errors);
      if (!Object.keys(errors).length) {
        this.saveError.set(
          errorCode(error) === 'NOT_FOUND' ? this.text().leadNotFound : this.text().leadSaveFailed,
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fieldNames, 'lead-')) {
      this.drawer().focusTitle();
    }
  }
}
