import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  patternValidator,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type { BrandStatus } from '../generated/brands-operations';
import { BrandsApi } from './brands-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = ['name', 'slug', 'status', 'logo'] as const;
type Field = (typeof fields)[number];
const transliteration: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
};

function slugFromName(name: string): string {
  return Array.from(name.toLowerCase(), (character) => transliteration[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 200)
    .replace(/^-|-$/g, '');
}

function encode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined;
      if (encoded) {
        resolve(encoded);
      } else {
        reject(new Error('Image could not be read'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Image could not be read'));
    };
    reader.readAsDataURL(file);
  });
}

@Component({
  selector: 'holita-brand-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
  ],
  templateUrl: './brand-editor.html',
  styleUrl: './brand-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandEditor {
  private readonly api = inject(BrandsApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() => this.params().get(this.routeData.recordParam ?? 'recordId'));
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly existingLogo = resource({
    params: () => {
      const scope = this.api.scope();
      const url = this.record.hasValue() ? this.record.value()?.logoUrl : null;
      return scope && url ? { scope, url } : undefined;
    },
    loader: ({ params }) => this.api.logo(params.scope, params.url),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (!this.editing) {
      return 'ready';
    }
    if (!uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return this.record.hasValue() && this.record.value() ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly statusOptions = computed(() => [
    { value: 'ACTIVE', label: this.text().brandActive },
    { value: 'HIDDEN', label: this.text().hidden },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  private readonly invalidFile = signal(false);
  protected readonly logo = signal<File | null | undefined>(undefined);
  protected readonly preview = signal<string | null>(null);
  protected readonly hasLogo = computed(() =>
    this.logo() === undefined
      ? this.record.hasValue() && !!this.record.value()?.logoUrl
      : this.logo() !== null,
  );
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true }), patternValidator(slugPattern)],
    }),
    status: new FormControl<BrandStatus>('ACTIVE', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const brand = this.record.hasValue() ? this.record.value() : null;
      this.form.reset(
        { name: brand?.name ?? '', slug: brand?.slug ?? '', status: brand?.status ?? 'ACTIVE' },
        { emitEvent: false },
      );
      this.logo.set(undefined);
      this.invalidFile.set(false);
      this.errors.set({});
      this.saveError.set(false);
    });
    effect((cleanup) => {
      const draft = this.logo();
      const image =
        draft === undefined && this.existingLogo.hasValue() ? this.existingLogo.value() : draft;
      const url = image ? URL.createObjectURL(image) : null;
      this.preview.set(url);
      if (url) {
        cleanup(() => {
          URL.revokeObjectURL(url);
        });
      }
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
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected error(field: Field): string | null {
    const control = field === 'logo' ? null : this.form.controls[field];
    return (
      (field === 'logo' && this.invalidFile() ? this.text().invalidLogo : this.errors()[field]) ??
      (control?.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected clearError(field: Field): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
  }

  protected changeName(name: string): void {
    this.clearError('name');
    if (!this.editing && this.form.controls.slug.pristine) {
      this.form.controls.slug.setValue(slugFromName(name));
      this.clearError('slug');
    }
  }

  protected chooseLogo(input: HTMLInputElement): void {
    const file = input.files?.item(0);
    input.value = '';
    if (!file) {
      return;
    }
    if (
      file.size === 0 ||
      file.size > 5 * 1024 * 1024 ||
      (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    ) {
      this.invalidFile.set(true);
      return;
    }
    this.setLogo(file);
  }

  protected setLogo(file: File | null): void {
    this.logo.set(file);
    this.invalidFile.set(false);
    this.clearError('logo');
    this.form.markAsDirty();
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    if (this.form.invalid || this.invalidFile()) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const draft = this.form.getRawValue();
    const file = this.logo();
    this.saving.set(true);
    try {
      const logo = file instanceof File ? await encode(file) : file;
      const id = await this.api.save(
        scope,
        { ...draft, ...(logo === undefined ? {} : { logo }) },
        this.id(),
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().brandSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code) =>
        code === 'INVALID_LOGO' ? this.text().invalidLogo : undefined,
      );
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'brand-')) {
      this.drawer().focusTitle();
    }
  }
}
