import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
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
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { LeadContactRole } from '../generated/contacts-operations';
import { LeadDetailPage } from '../leads/lead-detail-page';
import { leadLabel } from '../leads/lead-record';
import { contactRoleLabels, contactStrings } from './contact-labels';
import { ContactsApi } from './contacts-api';

const identityFields = ['name', 'phone', 'email'] as const;
const fieldNames = [...identityFields, 'notes'] as const;
type ContactField = (typeof fieldNames)[number];
const contactRoles: readonly LeadContactRole[] = [
  'OWNER',
  'MANAGER',
  'EMPLOYEE',
  'TECHNICAL',
  'UNKNOWN',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const identityValidator: ValidatorFn = (group) =>
  identityFields.some((field) => {
    const value: unknown = group.get(field)?.value;
    return typeof value === 'string' && !!value.trim();
  })
    ? null
    : { contactIdentity: true };

@Component({
  selector: 'holita-contact-editor',
  imports: [
    RouteDrawer,
    ReactiveFormsModule,
    FormField,
    InputText,
    Select,
    ToggleSwitch,
    Textarea,
    ButtonDirective,
    Message,
  ],
  templateUrl: './contact-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactEditor {
  private readonly api = inject(ContactsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  private readonly parentRecord = inject(LeadDetailPage).entry;
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly parentParams = toSignal(this.route.parent?.paramMap ?? this.route.paramMap, {
    requireSync: true,
  });
  private readonly leadId = computed(() => this.parentParams().get('recordId'));
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly contactId = computed(() =>
    this.editing ? this.params().get(this.routeData.recordParam ?? 'recordId') : null,
  );
  private readonly validContactId = computed(() => uuid.test(this.contactId() ?? ''));
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const lead = this.parentRecord.lead();
      const id = this.contactId();
      return scope &&
        lead &&
        lead.id === this.leadId()?.toLowerCase() &&
        id &&
        this.validContactId()
        ? { scope, leadId: lead.id, id }
        : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.find(params.scope, params.leadId, params.id, abortSignal),
  });

  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly closeLink = computed(() => ['/', this.language(), 'leads', this.leadId()]);
  protected readonly subtitle = computed(() => {
    const lead = this.parentRecord.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.parentRecord.validId() || (this.editing && !this.validContactId())) {
      return 'invalid-id';
    }
    if (this.parentRecord.record.isLoading() || this.record.isLoading()) {
      return 'loading';
    }
    if (this.parentRecord.record.error() || this.record.error()) {
      return 'error';
    }
    if (!this.parentRecord.lead() || (this.editing && !this.record.hasValue())) {
      return 'not-found';
    }
    return this.editing && !this.record.value() ? 'not-found' : 'ready';
  });
  protected readonly text = computed(() => contactStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saveLabel = computed(() => operatorStrings[this.language()].save);
  protected readonly roleOptions = computed(() => {
    const labels = contactRoleLabels(this.text());
    return contactRoles.map((value) => ({ value, label: labels[value] }));
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly errors = signal<Partial<Record<ContactField, string>>>({});
  private readonly builder = inject(NonNullableFormBuilder);
  protected readonly form = this.builder.group(
    {
      name: ['', textValidator(255)],
      phone: [''],
      email: ['', textValidator(255)],
      role: this.builder.control<LeadContactRole>('UNKNOWN'),
      isPrimary: [false],
      notes: [''],
    },
    { validators: identityValidator },
  );

  constructor() {
    effect(() => {
      const contact = this.record.hasValue() ? this.record.value() : null;
      this.form.reset({
        name: contact?.name ?? '',
        phone: contact?.phone ?? '',
        email: contact?.email ?? '',
        role: contact?.role ?? 'UNKNOWN',
        isPrimary: contact?.isPrimary ?? false,
        notes: contact?.notes ?? '',
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

  protected retry(): void {
    if (this.parentRecord.record.error()) {
      this.parentRecord.record.reload();
    } else {
      this.record.reload();
    }
  }

  protected fieldError(field: ContactField): string | null {
    const control = this.form.controls[field];
    const error = this.errors()[field];
    if (error) {
      return error;
    }
    if (!control.touched) {
      return null;
    }
    if (field === 'name' && this.form.hasError('contactIdentity')) {
      return this.text().contactIdentityRequired;
    }
    return validationMessage(control.errors, this.language());
  }

  protected clearError(field: ContactField): void {
    this.errors.update((errors) => {
      const { [field]: _error, ...otherErrors } = errors;
      const remaining: Partial<Record<ContactField, string>> = otherErrors;
      if (field !== 'notes' && remaining.name === this.text().contactIdentityRequired) {
        delete remaining.name;
      }
      return remaining;
    });
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    const lead = this.parentRecord.lead();
    if (!scope || !lead || this.saving() || this.state() !== 'ready') {
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
      const id = await this.api.save(scope, lead.id, this.contactId(), this.form.getRawValue());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().contactSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fieldNames, scope.language, (code, field) => {
        if (code === 'IDENTITY_REQUIRED') {
          return this.text().contactIdentityRequired;
        }
        if (code === 'INVALID_FORMAT') {
          if (field === 'phone') {
            return this.text().contactInvalidPhone;
          }
          if (field === 'email') {
            return this.text().contactInvalidEmail;
          }
        }
        return undefined;
      });
      this.errors.set(errors);
      if (!Object.keys(errors).length) {
        const code = errorCode(error);
        this.saveError.set(
          code === 'NOT_FOUND'
            ? this.text().contactNotFound
            : code === 'CONFLICT'
              ? this.text().contactPrimaryConflict
              : this.text().contactSaveFailed,
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fieldNames, 'contact-')) {
      this.drawer().focusTitle();
    }
  }
}
