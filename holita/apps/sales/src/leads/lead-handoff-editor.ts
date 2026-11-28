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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  FormField,
  RouteDrawer,
  UI_LANGUAGE,
  errorCode,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  uiMessages,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { ContactsApi } from '../contacts/contacts-api';
import { LeadDetailPage } from './lead-detail-page';
import { leadLabel } from './lead-record';
import { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

const onboardingFields = ['merchantName', 'adminName', 'adminEmail', 'branchName'] as const;
const fields = [...onboardingFields, 'initialPassword'] as const;
type Field = (typeof fields)[number];

@Component({
  selector: 'holita-lead-handoff-editor',
  imports: [RouteDrawer, ReactiveFormsModule, FormField, InputText, ButtonDirective, Message],
  templateUrl: './lead-handoff-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadHandoffEditor {
  private readonly parent = inject(LeadDetailPage).entry;
  private readonly api = inject(LeadsApi);
  private readonly contacts = inject(ContactsApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  private readonly lead = this.parent.lead;
  private readonly initialContact = resource({
    params: () => {
      const lead = this.lead();
      const scope = this.contacts.scope();
      return lead?.stage === 'WON' && !lead.handoff && scope ? { id: lead.id, scope } : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      const contacts = await this.contacts.listForLead(params.scope, params.id, abortSignal);
      return contacts.find((contact) => contact.isPrimary) ?? null;
    },
  });

  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly text = computed(() => leadStrings[this.language()].handoff);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly subtitle = computed(() => {
    const lead = this.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.parent.validId()) {
      return 'invalid-id';
    }
    if (this.parent.record.isLoading() || this.initialContact.isLoading()) {
      return 'loading';
    }
    if (this.parent.record.error() || this.initialContact.error()) {
      return 'error';
    }
    const lead = this.lead();
    return lead?.stage === 'WON' && lead.handoff?.state !== 'COMPLETED' ? 'ready' : 'not-found';
  });
  protected readonly pending = computed(() => this.lead()?.handoff?.state === 'PENDING');
  private readonly passwordRequested = signal(false);
  protected readonly showPassword = computed(() => !this.pending() || this.passwordRequested());
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly onboardingFields = onboardingFields;
  protected readonly form = inject(NonNullableFormBuilder).group({
    merchantName: '',
    adminName: '',
    adminEmail: '',
    branchName: '',
    initialPassword: '',
  });

  constructor() {
    effect(() => {
      const lead = this.lead();
      if (!lead || this.state() !== 'ready') {
        return;
      }
      const handoff = lead.handoff;
      const primary = this.initialContact.hasValue() ? this.initialContact.value() : null;
      this.form.reset({
        merchantName: handoff?.merchantName ?? lead.displayName ?? '',
        adminName: handoff?.adminName ?? primary?.name ?? '',
        adminEmail: handoff?.adminEmail ?? primary?.email ?? '',
        branchName: handoff?.branchName ?? '',
        initialPassword: '',
      });
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
    if (this.initialContact.error()) {
      this.initialContact.reload();
    } else {
      this.parent.record.reload();
    }
  }

  protected clearError(field: Field): void {
    this.errors.update(({ [field]: _error, ...remaining }) => remaining);
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    const lead = this.lead();
    if (!scope || !lead || this.saving() || this.state() !== 'ready') {
      return;
    }
    const isCurrent = () =>
      !this.destroyRef.destroyed && this.api.scope() === scope && this.lead()?.id === lead.id;
    const pending = this.pending();
    const { initialPassword, ...input } = this.form.getRawValue();
    if (this.showPassword() && !initialPassword) {
      this.errors.update((errors) => ({
        ...errors,
        initialPassword: this.shared().validation.required,
      }));
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    this.saving.set(true);
    this.errors.set({});
    this.saveError.set(null);
    this.form.controls.initialPassword.reset();
    try {
      const handoff = await this.api.convertWonLead(scope, {
        id: lead.id,
        input: pending ? undefined : input,
        initialPassword: initialPassword || undefined,
      });
      if (isCurrent()) {
        this.complete({ ...lead, handoff });
      }
    } catch (error: unknown) {
      if (!isCurrent()) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, path) =>
        path === 'initialPassword' && code === 'INVALID_FORMAT'
          ? this.text().passwordHint
          : undefined,
      );
      this.errors.set(errors);
      const code = errorCode(error);
      if (pending && errors.initialPassword) {
        this.passwordRequested.set(true);
      } else if (pending || code !== 'BAD_USER_INPUT') {
        const updated = await this.api.find(scope, lead.id).catch(() => null);
        if (!isCurrent()) {
          return;
        }
        if (updated?.handoff?.state === 'COMPLETED') {
          this.complete(updated);
          return;
        }
        if (
          updated &&
          (updated.stage !== lead.stage || updated.handoff?.state !== lead.handoff?.state)
        ) {
          this.passwordRequested.set(false);
          this.parent.record.set(updated);
        }
      }
      if (!Object.keys(errors).length) {
        this.saveError.set(
          code === 'BAD_USER_INPUT' ? this.text().rejected : this.text().unconfirmed,
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'handoff-')) {
      this.drawer().focusTitle();
    }
  }

  private complete(lead: NonNullable<ReturnType<typeof this.lead>>): void {
    this.form.markAsPristine();
    this.saving.set(false);
    this.parent.record.set(lead);
    this.drawerHost.saved({ message: this.text().completed, recordId: null });
    this.drawer().close();
  }
}
