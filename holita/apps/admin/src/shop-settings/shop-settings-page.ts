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
import { toSignal } from '@angular/core/rxjs-interop';
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
import { encodeImage } from '../image-upload';
import { ShopSettingsApi } from './shop-settings-api';
import { ShopBasicHomeFields } from './shop-basic-home-fields';
import { homeErrorFields, shopBasicHomeForm, shopBasicHomeInput } from './shop-basic-home-form';

const fields = ['displayName', 'contactEmail', 'contactPhone', 'contactAddress'] as const;
const brandingFields = ['logo', 'favicon'] as const;
const errorFields = [...fields, ...brandingFields, 'brandingImages', ...homeErrorFields];
const maxImageBytes = 5 * 1024 * 1024;
const publicEmail = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/u;
type BrandingField = (typeof brandingFields)[number];
type SettingsField = (typeof fields)[number] | BrandingField;
type SettingsScope = NonNullable<ReturnType<ShopSettingsApi['scope']>>;
type ImageDraft = File | 'keep' | null;

function validImage(file: File): boolean {
  return (
    file.size > 0 &&
    file.size <= maxImageBytes &&
    (!file.type || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
  );
}

function imageControl() {
  return new FormControl<ImageDraft>('keep', {
    nonNullable: true,
    validators: [
      (control) => {
        const value: unknown = control.value;
        return value instanceof File && !validImage(value) ? { invalidImage: true } : null;
      },
    ],
  });
}

function imageInput(value: ImageDraft): Promise<string> | null | undefined {
  return value instanceof File ? encodeImage(value) : value === 'keep' ? undefined : null;
}

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
    ShopBasicHomeFields,
    Textarea,
  ],
  providers: [ConfirmationService],
  templateUrl: './shop-settings-page.html',
  styleUrl: './shop-settings-page.scss',
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
  protected readonly brandingFields = brandingFields;
  private pendingLeave: Promise<boolean> | null = null;
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254), patternValidator(publicEmail)],
    }),
    contactPhone: new FormControl('', { nonNullable: true, validators: [textValidator(50)] }),
    contactAddress: new FormControl('', { nonNullable: true, validators: [textValidator(500)] }),
    logo: imageControl(),
    favicon: imageControl(),
    basicHome: shopBasicHomeForm(),
  });
  private readonly imageDrafts = {
    logo: toSignal(this.form.controls.logo.valueChanges, { initialValue: 'keep' }),
    favicon: toSignal(this.form.controls.favicon.valueChanges, { initialValue: 'keep' }),
  };
  private readonly previews = signal<Partial<Record<BrandingField, string>>>({});

  constructor() {
    effect(() => {
      const saved = this.record.hasValue() ? this.record.value() : null;
      untracked(() => {
        this.resetDraft(saved);
      });
    });
    effect((cleanup) => {
      const urls: Partial<Record<BrandingField, string>> = {};
      for (const field of brandingFields) {
        const draft = this.imageDrafts[field]();
        if (draft instanceof File && validImage(draft)) {
          urls[field] = URL.createObjectURL(draft);
        }
      }
      this.previews.set(urls);
      cleanup(() => {
        for (const url of Object.values(urls)) {
          URL.revokeObjectURL(url);
        }
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
    if (errors?.['invalidImage']) {
      return this.text().productImageInvalid;
    }
    return field === 'contactEmail' && Object.keys(errors ?? {})[0] === 'pattern'
      ? this.text().invalidContactEmail
      : validationMessage(errors, this.language());
  }

  protected clearError(field: string): void {
    this.errors.update((errors) => ({
      ...errors,
      [field]: undefined,
      ...(field === 'basicHomeImages' && { brandingImages: undefined }),
    }));
    this.saveError.set(false);
  }

  protected imagePreview(field: BrandingField): string | null {
    const draft = this.imageDrafts[field]();
    if (draft === 'keep' && this.record.hasValue()) {
      return this.record.value()[field === 'logo' ? 'logoUrl' : 'faviconUrl'] ?? null;
    }
    return this.previews()[field] ?? null;
  }

  protected chooseImage(field: BrandingField, input: HTMLInputElement): void {
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      this.changeImage(field, file);
    }
  }

  protected changeImage(field: BrandingField, value: File | null): void {
    const control = this.form.controls[field];
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
    this.clearError(field);
    this.clearError('basicHomeImages');
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
    const { basicHome, logo, favicon, ...details } = this.form.getRawValue();
    const editAppearance = this.form.controls.basicHome.dirty;
    const homeImages = editAppearance
      ? [
          basicHome.heroImageUpload,
          ...basicHome.tiles.filter(({ custom }) => custom).map(({ imageUpload }) => imageUpload),
        ]
      : [];
    const files = [logo, favicon, ...homeImages];
    const imageBytes = files.reduce(
      (total, file) => total + (file instanceof File ? file.size : 0),
      0,
    );
    if (imageBytes > maxImageBytes) {
      const field =
        logo instanceof File || favicon instanceof File ? 'brandingImages' : 'basicHomeImages';
      this.errors.set({ [field]: this.text().productImageBatchTooLarge });
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
      const saved = await this.api.save(scope, {
        ...details,
        logo: await imageInput(logo),
        favicon: await imageInput(favicon),
        basicHome: editAppearance ? await shopBasicHomeInput(basicHome) : undefined,
      });
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
      const errors = fieldErrors(error, errorFields, scope.language, (code, field) => {
        if (field === 'contactEmail' && code === 'INVALID_EMAIL') {
          return this.text().invalidContactEmail;
        }
        switch (code) {
          case 'INVALID_DESTINATION':
            return this.text().homeInvalidLink;
          case 'INVALID_IMAGE':
            return this.text().productImageInvalid;
          case 'IMAGE_BATCH_TOO_LARGE':
            return this.text().productImageBatchTooLarge;
          default:
            return undefined;
        }
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      if (this.savingScope() === scope) {
        this.savingScope.set(null);
      }
    }
  }

  private resetDraft(saved: OperatorShopSettingsFieldsFragment | null): void {
    const basicHome = shopBasicHomeForm(saved?.basicHome);
    this.form.setControl('basicHome', basicHome);
    this.form.reset({
      basicHome: basicHome.getRawValue(),
      displayName: saved?.displayName ?? '',
      contactEmail: saved?.contactEmail ?? '',
      contactPhone: saved?.contactPhone ?? '',
      contactAddress: saved?.contactAddress ?? '',
      logo: 'keep',
      favicon: 'keep',
    });
    this.errors.set({});
    this.saveError.set(false);
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (
      form &&
      !focusFirstInvalid(form, errorFields, 'shop-settings-') &&
      (this.saveError() || this.errors()['basicHomeImages'] || this.errors()['brandingImages'])
    ) {
      this.pageHeader().focusTitle();
    }
  }
}
