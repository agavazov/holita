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
  integerValidator,
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
import { slugFromName } from '../catalogue-slug';
import { CategoriesApi } from './categories-api';
import { categoryOptions } from './category-tree';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = ['name', 'slug', 'parentId', 'sortOrder', 'active'] as const;
type Field = (typeof fields)[number];

@Component({
  selector: 'holita-category-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
  ],
  templateUrl: './category-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryEditor {
  private readonly api = inject(CategoriesApi);
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
  private readonly tree = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.api.list(params),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading() || this.tree.isLoading()) {
      return 'loading';
    }
    if (this.record.error() || this.tree.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly parentOptions = computed(() =>
    categoryOptions(
      this.tree.hasValue() ? this.tree.value() : [],
      this.text().topLevelCategory,
      this.id(),
    ),
  );
  protected readonly statusOptions = computed(() => [
    { value: true, label: this.text().categoryActive },
    { value: false, label: this.text().hidden },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true }), patternValidator(slugPattern)],
    }),
    parentId: new FormControl<string | null>(null),
    sortOrder: new FormControl<number | null>(0, {
      validators: [integerValidator(0, 2_147_483_647, { required: true })],
    }),
    active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const category = this.record.hasValue() ? this.record.value() : null;
      this.form.reset(
        {
          name: category?.name ?? '',
          slug: category?.slug ?? '',
          parentId: category?.parentId ?? null,
          sortOrder: category?.sortOrder ?? 0,
          active: category?.active ?? true,
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
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
  }

  protected changeName(name: string): void {
    this.clearError('name');
    if (!this.editing && this.form.controls.slug.pristine) {
      this.form.controls.slug.setValue(slugFromName(name));
      this.clearError('slug');
    }
  }

  protected retry(): void {
    if (this.record.error()) {
      this.record.reload();
    }
    if (this.tree.error()) {
      this.tree.reload();
    }
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    const { sortOrder, ...draft } = this.form.getRawValue();
    if (this.form.invalid || sortOrder === null) {
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
      const id = await this.api.save(scope, { ...draft, sortOrder }, this.id());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().categorySaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, field) => {
        if (field === 'parentId') {
          return code === 'CATEGORY_CYCLE'
            ? this.text().categoryCycle
            : this.text().categoryParentUnavailable;
        }
        return undefined;
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
      !focusFirstInvalid(form, ['name', 'slug', 'parent', 'sort-order', 'active'], 'category-')
    ) {
      this.drawer().focusTitle();
    }
  }
}
