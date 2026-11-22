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
  formatDateTimeCell,
  injectDrawerHost,
  lockWhileSaving,
  patternValidator,
  selectMultiplePt,
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
import { slugFromName } from '../catalogue-slug';
import type { BlogArticleStatus } from '../generated/blog-operations';
import { BlogApi } from './blog-api';
import { articleStatus, articleStatuses, articleTitle } from './blog-article-labels';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ['slug', 'status', 'tagIds', 'titleBg', 'bodyBg', 'titleEn', 'bodyEn'] as const;
type Field = (typeof fields)[number];

@Component({
  selector: 'holita-blog-article-editor',
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
  templateUrl: './blog-article-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArticleEditor {
  private readonly api = inject(BlogApi);
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
  private readonly canWrite = this.api.canWrite;
  protected readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return this.canWrite() && scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.article(params.scope, params.id),
  });
  protected readonly tagChoices = resource({
    params: () => (this.canWrite() ? (this.api.scope() ?? undefined) : undefined),
    loader: ({ params }) => this.api.tagChoices(params),
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
  private readonly savedArticle = computed(() =>
    this.record.hasValue() ? this.record.value() : null,
  );
  protected readonly subtitle = computed(() => {
    const article = this.savedArticle();
    return article ? articleTitle(article, this.language.value()) : null;
  });
  protected readonly publication = computed(() => {
    const value = this.savedArticle()?.publishedAt;
    return value ? { value, ...formatDateTimeCell(value, this.language.value(), 'UTC') } : null;
  });
  protected readonly tagOptions = computed(() =>
    this.tagChoices.hasValue() ? this.tagChoices.value() : (this.savedArticle()?.tags ?? []),
  );
  protected readonly statusOptions = computed(() =>
    articleStatuses.map((value) => ({
      value,
      label: articleStatus(value, this.language.value()),
    })),
  );
  protected readonly translations = computed(
    () =>
      [
        {
          lang: 'bg',
          title: 'titleBg',
          titleLabel: this.text().blogTitleBg,
          body: 'bodyBg',
          bodyLabel: this.text().blogBodyBg,
        },
        {
          lang: 'en',
          title: 'titleEn',
          titleLabel: this.text().blogTitleEn,
          body: 'bodyEn',
          bodyLabel: this.text().blogBodyEn,
        },
      ] as const,
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string | undefined>>>({});
  protected readonly tagPt = computed(() => ({
    label: {
      ...selectMultiplePt.label,
      'aria-describedby': 'blog-article-tags-error blog-article-tags-load-error',
      'aria-invalid': this.errors().tagIds ? 'true' : undefined,
    },
    option: { style: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
  }));
  protected readonly form = new FormGroup({
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        textValidator(200, { required: true }),
        patternValidator(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
      ],
    }),
    status: new FormControl<BlogArticleStatus>('DRAFT', { nonNullable: true }),
    tagIds: new FormControl<string[]>([], { nonNullable: true }),
    titleBg: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    bodyBg: new FormControl('', { nonNullable: true }),
    titleEn: new FormControl('', { nonNullable: true, validators: [textValidator(200)] }),
    bodyEn: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const article = this.savedArticle();
      this.form.reset(
        {
          slug: article?.slug ?? '',
          status: article?.status ?? 'DRAFT',
          tagIds: article?.tags.map(({ id }) => id) ?? [],
          titleBg: article?.titleBg ?? '',
          bodyBg: article?.bodyBg ?? '',
          titleEn: article?.titleEn ?? '',
          bodyEn: article?.bodyEn ?? '',
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
      ...(field.startsWith('title') || field.startsWith('body') ? { status: undefined } : {}),
    }));
  }

  protected changeTitle(field: 'titleBg' | 'titleEn', value: string): void {
    this.clearError(field);
    if (!this.editing && this.form.controls.slug.pristine) {
      const bg = field === 'titleBg' ? value : this.form.controls.titleBg.value;
      const en = field === 'titleEn' ? value : this.form.controls.titleEn.value;
      this.form.controls.slug.setValue(slugFromName(bg.trim() || en));
      this.clearError('slug');
    }
  }

  protected changeTags(picker: Select, event: Event | undefined): void {
    this.clearError('tagIds');
    if (event?.type === 'click') {
      picker.focus();
    }
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
      const id = await this.api.saveArticle(scope, draft, this.id());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().blogArticleSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (_code, field) =>
        field === 'status' ? this.text().blogPublishNeedsTranslation : undefined,
      );
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
        ['slug', 'status', 'tags', 'title-bg', 'body-bg', 'title-en', 'body-en'],
        'blog-article-',
      )
    ) {
      this.drawer().focusTitle();
    }
  }
}
