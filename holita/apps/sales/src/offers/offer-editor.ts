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
import { ActivatedRoute } from '@angular/router';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  UI_LANGUAGE,
  dateOnlyValidator,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { contactStrings } from '../contacts/contact-labels';
import { ContactsApi } from '../contacts/contacts-api';
import type { SalesQuoteLineInput } from '../generated/offers-operations';
import { LeadDetailPage } from '../leads/lead-detail-page';
import { leadLabel } from '../leads/lead-record';
import { contactFields, offerStrings, quoteKinds, siteFields, type QuoteKind } from './offer';
import { OfferDetailPage } from './offer-detail-page';
import { OffersApi } from './offers-api';

const quoteFields = ['planName', 'monthlyPrice'] as const;
type QuoteField = (typeof quoteFields)[number];
type QuotePath = `${QuoteKind}.${QuoteField}`;
const quotePaths = quoteKinds.flatMap((kind) =>
  quoteFields.map((field): QuotePath => `${kind}.${field}`),
);
const noteFields = ['includedScope', 'message'] as const;
const fields = [
  ...quotePaths,
  ...contactFields.map(({ key }) => key),
  ...siteFields.map(({ key }) => key),
  ...noteFields,
] as const;
type Field = (typeof fields)[number];
type MainField = Exclude<Field, QuotePath>;

@Component({
  selector: 'holita-offer-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Textarea,
  ],
  templateUrl: './offer-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferEditor {
  private readonly api = inject(OffersApi);
  private readonly contacts = inject(ContactsApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly parentParams = toSignal(this.route.parent?.paramMap ?? this.route.paramMap, {
    requireSync: true,
  });
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  private readonly offerPage = inject(OfferDetailPage, { optional: true });
  private readonly leadPage = inject(LeadDetailPage, { optional: true });
  private readonly linkedLead = computed(() => this.leadPage?.entry.lead() ?? null);
  protected readonly editing = !!this.offerPage;
  private readonly existing = computed(() => this.offerPage?.offer() ?? null);
  protected readonly sent = computed(() => this.existing()?.status === 'MANUALLY_SENT');
  private readonly primary = resource({
    params: () => {
      const scope = this.api.scope();
      const lead = this.linkedLead();
      return scope && lead ? { scope, leadId: lead.id } : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      const contacts = await this.contacts.listForLead(params.scope, params.leadId, abortSignal);
      return contacts.find((contact) => contact.isPrimary) ?? null;
    },
  });
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly closeLink = computed(() => {
    const language = this.language();
    if (this.leadPage) {
      return ['/', language, 'leads', this.parentParams().get('recordId')];
    }
    return this.offerPage
      ? ['/', language, 'offers', this.offerPage.id()]
      : ['/', language, 'offers'];
  });
  protected readonly subtitle = computed(() => {
    const lead = this.linkedLead();
    return lead ? leadLabel(lead) : (this.existing()?.recipientName ?? null);
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (this.leadPage) {
      const { validId, record, lead } = this.leadPage.entry;
      if (!validId()) {
        return 'invalid-id';
      }
      if (record.isLoading() || this.primary.isLoading()) {
        return 'loading';
      }
      if (record.error() || this.primary.error()) {
        return 'error';
      }
      return lead() ? 'ready' : 'not-found';
    }
    if (this.offerPage) {
      if (!this.offerPage.validId()) {
        return 'invalid-id';
      }
      if (this.offerPage.record.isLoading()) {
        return 'loading';
      }
      if (this.offerPage.record.error()) {
        return 'error';
      }
      return this.existing() ? 'ready' : 'not-found';
    }
    return 'ready';
  });
  protected readonly text = computed(() => offerStrings[this.language()]);
  protected readonly loadError = computed(() =>
    this.primary.error()
      ? contactStrings[this.language()].contactsUnavailable
      : this.text().offerUnavailable,
  );
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saveLabel = computed(() => operatorStrings[this.language()].save);
  protected readonly contextGroups = [
    { title: 'contact', fields: contactFields },
    { title: 'context', fields: siteFields },
  ] as const;
  protected readonly quoteKinds = quoteKinds;
  protected readonly noteFields = noteFields;
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly errors = signal<Partial<Record<Field, string>>>({});
  private readonly builder = inject(NonNullableFormBuilder);
  protected readonly form = this.builder.group({
    recipientName: ['', textValidator(255)],
    recipientEmail: ['', textValidator(254)],
    replyEmail: ['', textValidator(254)],
    replyPhone: ['', textValidator(255)],
    currentSiteUrl: ['', textValidator(2048)],
    proposedSiteUrl: ['', textValidator(2048)],
    exampleDomain: ['', textValidator(253)],
    validUntil: ['', dateOnlyValidator(null, null)],
    productCount: new FormControl<number | null>(null, integerValidator(0, 2_147_483_647)),
    categoryCount: new FormControl<number | null>(null, integerValidator(0, 2_147_483_647)),
    languages: ['', textValidator(120)],
    currentPlatform: ['', textValidator(120)],
    message: ['', textValidator(700)],
    includedScope: ['', textValidator(4000)],
    recommended: this.quoteGroup(),
    alternative: this.quoteGroup(),
  });

  constructor() {
    effect(() => {
      if (this.state() !== 'ready') {
        return;
      }
      const offer = this.existing();
      const lead = this.linkedLead();
      const primary = this.primary.hasValue() ? this.primary.value() : null;
      this.form.reset({
        recipientName: offer
          ? (offer.recipientName ?? '')
          : (primary?.name ?? lead?.displayName ?? ''),
        recipientEmail: offer ? (offer.recipientEmail ?? '') : (primary?.email ?? ''),
        replyEmail: offer?.replyEmail ?? '',
        replyPhone: offer?.replyPhone ?? '',
        currentSiteUrl: offer ? (offer.currentSiteUrl ?? '') : (lead?.websiteUrl ?? ''),
        proposedSiteUrl: offer?.proposedSiteUrl ?? '',
        exampleDomain: offer?.exampleDomain ?? '',
        validUntil: offer?.validUntil ?? '',
        productCount: offer?.productCount ?? null,
        categoryCount: offer?.categoryCount ?? null,
        languages: offer?.languages ?? '',
        currentPlatform: offer?.currentPlatform ?? '',
        message: offer?.message ?? '',
        includedScope: offer?.includedScope ?? '',
        recommended: offer?.recommended ?? { planName: '', monthlyPrice: '' },
        alternative: offer?.alternative ?? { planName: '', monthlyPrice: '' },
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
    if (this.offerPage) {
      this.offerPage.record.reload();
    } else if (this.primary.error()) {
      this.primary.reload();
    } else {
      this.leadPage?.entry.record.reload();
    }
  }

  protected fieldError(field: MainField): string | null {
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected quoteError(kind: QuoteKind, field: QuoteField): string | null {
    const control = this.form.controls[kind].controls[field];
    return (
      this.errors()[`${kind}.${field}`] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(field: Field): void {
    this.errors.update(({ [field]: _error, ...remaining }) => remaining);
  }

  protected clearQuoteError(kind: QuoteKind, field: QuoteField): void {
    const { planName, monthlyPrice } = this.form.controls[kind].getRawValue();
    if (!planName.trim() && !monthlyPrice.trim()) {
      this.clearError(`${kind}.planName`);
      this.clearError(`${kind}.monthlyPrice`);
      return;
    }
    this.clearError(`${kind}.${field}`);
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.sent() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(null);
    const errors: Partial<Record<Field, string>> = {};
    const values = this.form.getRawValue();
    const recommended = this.quoteInput('recommended', values.recommended, errors);
    const alternative = this.quoteInput('alternative', values.alternative, errors);
    this.errors.set(errors);
    if (this.form.invalid || Object.keys(errors).length) {
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
      const id = await this.api.save(
        scope,
        { ...values, recommended, alternative },
        this.existing()?.id ?? null,
        this.linkedLead()?.id ?? null,
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().offerSaved, recordId: id });
      if (this.editing || this.leadPage) {
        this.drawer().close();
      }
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const messages = fieldErrors(error, fields, scope.language, (code, path) => {
        if (code === 'INVALID_VALUE' && path.endsWith('.monthlyPrice')) {
          return this.text().invalidPrice;
        }
        if (code === 'INVALID_FORMAT' && (path === 'recipientEmail' || path === 'replyEmail')) {
          return contactStrings[scope.language].contactInvalidEmail;
        }
        return undefined;
      });
      this.errors.set(messages);
      if (!Object.keys(messages).length) {
        this.saveError.set(this.text().offerSaveFailed);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private quoteGroup() {
    return this.builder.group({ planName: ['', textValidator(80)], monthlyPrice: '' });
  }

  private quoteInput(
    kind: QuoteKind,
    line: SalesQuoteLineInput,
    errors: Partial<Record<Field, string>>,
  ): SalesQuoteLineInput | null {
    const planName = line.planName.trim();
    const monthlyPrice = line.monthlyPrice.trim().replace(',', '.');
    if (!planName && !monthlyPrice) {
      return null;
    }
    if (!planName) {
      errors[`${kind}.planName`] = this.shared().validation.required;
    }
    if (!monthlyPrice) {
      errors[`${kind}.monthlyPrice`] = this.shared().validation.required;
    } else if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(monthlyPrice)) {
      errors[`${kind}.monthlyPrice`] = this.text().invalidPrice;
    }
    return { planName, monthlyPrice };
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'offer-')) {
      this.drawer().focusTitle();
    }
  }
}
