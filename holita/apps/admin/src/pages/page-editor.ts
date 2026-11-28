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
import { Textarea } from 'primeng/textarea';
import type { ShopPageStatus } from '../generated/pages-operations';
import { pagePath, pageTitle } from './page-labels';
import { PagesApi } from './pages-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ['slug', 'status', 'titleBg', 'bodyBg', 'titleEn', 'bodyEn'] as const;
type Field = (typeof fields)[number];

@Component({
  selector: 'holita-page-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Textarea,
  ],
  templateUrl: './page-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditor {
  private readonly api = inject(PagesApi);
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
  private readonly canWrite = computed(
    () => !!this.api.scope() && this.session.hasRole('OPERATOR'),
  );
  protected readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return this.canWrite() && scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.canWrite()) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  private readonly savedPage = computed(() =>
    this.record.hasValue() ? this.record.value() : null,
  );
  protected readonly isSystem = computed(() => this.savedPage()?.isSystem ?? false);
  protected readonly subtitle = computed(() => {
    const page = this.savedPage();
    return page ? pageTitle(page, this.language.value()) : null;
  });
  protected readonly path = computed(() => {
    const page = this.savedPage();
    return page ? pagePath(this.api.scope()?.branchId, page) : null;
  });
  protected readonly statusOptions = computed(() => [
    { value: 'DRAFT', label: this.text().draft },
    { value: 'PUBLISHED', label: this.text().pagePublished },
  ]);
  protected readonly translations = computed(
    () =>
      [
        {
          lang: 'bg',
          title: 'titleBg',
          titleLabel: this.text().pageTitleBg,
          body: 'bodyBg',
          bodyLabel: this.text().pageBodyBg,
        },
        {
          lang: 'en',
          title: 'titleEn',
          titleLabel: this.text().pageTitleEn,
          body: 'bodyEn',
          bodyLabel: this.text().pageBodyEn,
        },
      ] as const,
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string | undefined>>>({});
  protected readonly form = new FormGroup({
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        textValidator(200, { required: true }),
        patternValidator(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
      ],
    }),
    status: new FormControl<ShopPageStatus>('DRAFT', { nonNullable: true }),
    titleBg: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    bodyBg: new FormControl('', { nonNullable: true }),
    titleEn: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    bodyEn: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const page = this.savedPage();
      this.form.reset(
        {
          slug: page?.slug ?? '',
          status: page?.status ?? 'DRAFT',
          titleBg: page?.titleBg ?? '',
          bodyBg: page?.bodyBg ?? '',
          titleEn: page?.titleEn ?? '',
          bodyEn: page?.bodyEn ?? '',
        },
        { emitEvent: false },
      );
      this.errors.set({});
      this.saveError.set(false);
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
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected clearError(field: Field): void {
    this.errors.update((errors) => ({
      ...errors,
      [field]: undefined,
      ...(field === 'slug' ? {} : { status: undefined }),
    }));
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
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
    const draft = this.form.getRawValue();
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, draft, this.id());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().pageSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, field) => {
        if (code === 'SYSTEM_PAGE_SLUG') {
          return this.text().pageSystemSlug;
        }
        return field === 'status' ? this.text().pagePublishNeedsTranslation : undefined;
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (
      !form ||
      !focusFirstInvalid(
        form,
        ['slug', 'status', 'title-bg', 'body-bg', 'title-en', 'body-en'],
        'page-',
      )
    ) {
      this.drawer().focusTitle();
    }
  }
}
