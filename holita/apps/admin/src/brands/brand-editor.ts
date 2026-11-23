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
  input,
  output,
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
  type DrawerSaved,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type { BrandStatus } from '../generated/brands-operations';
import { slugFromName } from '../catalogue-slug';
import { encodeImage } from '../image-upload';
import { BrandsApi } from './brands-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = ['name', 'slug', 'status', 'logo'] as const;
type Field = (typeof fields)[number];

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
  readonly createInProduct = input(false);
  readonly productDirty = input(false);
  readonly created = output<DrawerSaved>();
  readonly createClosed = output();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = computed(() => drawerRouteData(this.route));
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = computed(
    () => !this.createInProduct() && this.routeData().mode === 'edit',
  );
  private readonly id = computed(() =>
    this.editing() ? this.params().get(this.routeData().recordParam ?? 'recordId') : null,
  );
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
    if (!this.editing()) {
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

  canLeave(productDirty = false): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty || productDirty);
  }

  protected async closeCreate(): Promise<void> {
    if (await this.canLeave()) {
      this.createClosed.emit();
    }
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
    if (!this.editing() && this.form.controls.slug.pristine) {
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
      const logo = file instanceof File ? await encodeImage(file) : file;
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
      const event = { message: this.text().brandSaved, recordId: id };
      if (this.createInProduct()) {
        this.created.emit(event);
      } else {
        this.drawerHost.saved(event);
        this.drawer().close();
      }
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
