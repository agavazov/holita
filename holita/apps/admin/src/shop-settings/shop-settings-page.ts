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
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  EmptyState,
  FormField,
  PageHeader,
  confirmDialogPt,
  confirmDiscard,
  fieldErrors,
  focusFirstInvalid,
  lockWhileSaving,
  patternValidator,
  textValidator,
  uiMessages,
  validationMessage,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import type { OperatorShopSettingsFieldsFragment } from '../generated/shop-settings-operations';
import { ShopSettingsApi } from './shop-settings-api';

const fields = ['displayName', 'contactEmail', 'contactPhone', 'contactAddress'] as const;
const publicEmail = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/u;
type SettingsField = (typeof fields)[number];
type SettingsScope = NonNullable<ReturnType<ShopSettingsApi['scope']>>;

@Component({
  selector: 'holita-shop-settings-page',
  imports: [
    ButtonDirective,
    ConfirmDialog,
    EmptyState,
    FormField,
    InputText,
    Message,
    PageHeader,
    ReactiveFormsModule,
    Skeleton,
    Textarea,
  ],
  providers: [ConfirmationService],
  templateUrl: './shop-settings-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopSettingsPage {
  private readonly api = inject(ShopSettingsApi);
  private readonly language = inject(OperatorLanguage).value;
  private readonly session = inject(DemoSession);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('settingsForm');
  private readonly pageHeader = viewChild.required(PageHeader);
  protected readonly scope = this.api.scope;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly discardDialogPt = computed(() => confirmDialogPt(this.language()));
  protected readonly canWrite = computed(() => !!this.scope() && this.session.hasRole('OPERATOR'));
  protected readonly record = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params }) => this.api.read(params),
  });
  private readonly savingScope = signal<SettingsScope | null>(null);
  protected readonly saving = computed(() => {
    const scope = this.savingScope();
    return scope !== null && scope === this.scope();
  });
  protected readonly saveError = signal(false);
  private pendingLeave: Promise<boolean> | null = null;
  private readonly errors = signal<Partial<Record<SettingsField, string>>>({});
  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254), patternValidator(publicEmail)],
    }),
    contactPhone: new FormControl('', { nonNullable: true, validators: [textValidator(50)] }),
    contactAddress: new FormControl('', { nonNullable: true, validators: [textValidator(500)] }),
  });

  constructor() {
    effect(() => {
      const saved = this.record.hasValue() ? this.record.value() : null;
      untracked(() => {
        this.resetDraft(saved);
      });
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
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

  protected fieldError(field: SettingsField): string | null {
    const serverError = this.errors()[field];
    const control = this.form.controls[field];
    if (serverError || !control.touched) {
      return serverError ?? null;
    }
    const errors = control.errors;
    return field === 'contactEmail' && Object.keys(errors ?? {})[0] === 'pattern'
      ? this.text().invalidContactEmail
      : validationMessage(errors, this.language());
  }

  protected clearError(field: SettingsField): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected discard(): void {
    if (this.canWrite() && !this.saving() && this.record.hasValue()) {
      this.resetDraft(this.record.value());
      this.pageHeader().focusTitle();
    }
  }

  protected async save(): Promise<void> {
    const scope = this.scope();
    if (
      !scope ||
      !this.canWrite() ||
      this.saving() ||
      !this.record.hasValue() ||
      !this.form.dirty
    ) {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    this.savingScope.set(scope);
    try {
      const saved = await this.api.save(scope, this.form.getRawValue());
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      this.record.set(saved);
      this.messages.add({ severity: 'success', summary: this.text().generalSettingsSaved });
      this.pageHeader().focusTitle();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, field) =>
        field === 'contactEmail' && code === 'INVALID_EMAIL'
          ? this.text().invalidContactEmail
          : undefined,
      );
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      if (this.savingScope() === scope) {
        this.savingScope.set(null);
      }
    }
  }

  private resetDraft(saved: OperatorShopSettingsFieldsFragment | null): void {
    this.form.reset({
      displayName: saved?.displayName ?? '',
      contactEmail: saved?.contactEmail ?? '',
      contactPhone: saved?.contactPhone ?? '',
      contactAddress: saved?.contactAddress ?? '',
    });
    this.errors.set({});
    this.saveError.set(false);
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (form && !focusFirstInvalid(form, fields, 'shop-settings-') && this.saveError()) {
      this.pageHeader().focusTitle();
    }
  }
}
