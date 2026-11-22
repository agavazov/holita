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
  innerInputPt,
  interpolate,
  lockWhileSaving,
  normalizeSearch,
  patternValidator,
  searchApplies,
  textValidator,
  toneSeverity,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { AutoComplete } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { ArrowDownIcon } from 'primeng/icons/arrowdown';
import { ArrowUpIcon } from 'primeng/icons/arrowup';
import { TrashIcon } from 'primeng/icons/trash';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { BrandsApi } from '../brands/brands-api';
import { slugFromName } from '../catalogue-slug';
import { CategoriesApi } from '../categories/categories-api';
import { categoryRows } from '../categories/category-tree';
import type {
  CollectionProductFieldsFragment,
  ProductCollectionInput,
  ProductCollectionMode,
  ProductStatus,
} from '../generated/collections-operations';
import { CollectionsApi } from './collections-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = ['name', 'slug', 'mode', 'active', 'categoryId', 'brandId', 'productIds'] as const;
type Field = (typeof fields)[number];
const productLimit = 20;

@Component({
  selector: 'holita-collection-editor',
  imports: [
    ArrowDownIcon,
    ArrowUpIcon,
    AutoComplete,
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Tag,
    TrashIcon,
  ],
  templateUrl: './collection-editor.html',
  styleUrl: './collection-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionEditor {
  private readonly api = inject(CollectionsApi);
  private readonly brands = inject(BrandsApi);
  private readonly categories = inject(CategoriesApi);
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
  private readonly scope = computed(() =>
    this.session.hasRole('OPERATOR') ? this.api.scope() : null,
  );
  private readonly record = resource({
    params: () => {
      const scope = this.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.scope()) {
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
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly statusOptions = computed(() => [
    { value: true, label: this.text().collectionActive },
    { value: false, label: this.text().collectionInactive },
  ]);
  protected readonly modeOptions = computed(() => [
    { value: 'MANUAL', label: this.text().collectionManual },
    { value: 'CATEGORY', label: this.text().collectionByCategory },
    { value: 'BRAND', label: this.text().collectionByBrand },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string | undefined>>>({});
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true }), patternValidator(slugPattern)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    mode: new FormControl<ProductCollectionMode>('MANUAL', { nonNullable: true }),
    categoryId: new FormControl<string | null>(null),
    brandId: new FormControl<string | null>(null),
    products: new FormControl<readonly CollectionProductFieldsFragment[]>([], {
      nonNullable: true,
    }),
  });
  protected readonly picker = new FormControl<CollectionProductFieldsFragment | string | null>(
    null,
  );
  protected readonly mode = toSignal(this.form.controls.mode.valueChanges, {
    initialValue: this.form.controls.mode.value,
  });
  protected readonly selectedProducts = toSignal(this.form.controls.products.valueChanges, {
    initialValue: this.form.controls.products.value,
  });
  protected readonly categoryRules = resource({
    params: () =>
      this.state() === 'ready' && this.mode() === 'CATEGORY'
        ? (this.scope() ?? undefined)
        : undefined,
    loader: ({ params }) => this.categories.list(params),
  });
  protected readonly categoryOptions = computed(() =>
    categoryRows(this.categoryRules.hasValue() ? this.categoryRules.value() : []).map(
      ({ id, path }) => ({ id, name: path }),
    ),
  );
  protected readonly brandRules = resource({
    params: () =>
      this.state() === 'ready' && this.mode() === 'BRAND' ? (this.scope() ?? undefined) : undefined,
    loader: ({ params, abortSignal }) => this.brands.options(params, abortSignal),
  });
  protected readonly brandOptions = computed(() =>
    this.brandRules.hasValue() ? this.brandRules.value() : [],
  );
  protected readonly ruleUnavailable = computed(
    () =>
      (this.mode() === 'CATEGORY' && !this.categoryRules.hasValue()) ||
      (this.mode() === 'BRAND' && !this.brandRules.hasValue()),
  );
  private readonly productSearch = signal<string | null>(null);
  protected readonly productSearchInvalid = computed(
    () => !searchApplies(this.productSearch() ?? ''),
  );
  protected readonly productResults = resource({
    params: () => {
      const scope = this.scope();
      const search = this.productSearch();
      return scope && this.mode() === 'MANUAL' && search !== null && !this.productSearchInvalid()
        ? { scope, search }
        : undefined;
    },
    loader: ({ params }) =>
      this.api.products(params.scope, { offset: 0, limit: productLimit, search: params.search }),
  });
  protected readonly suggestions = computed(() => {
    const selected = new Set(this.selectedProducts().map(({ id }) => id));
    return this.productResults.hasValue()
      ? this.productResults.value().items.filter(({ id }) => !selected.has(id))
      : [];
  });
  protected readonly moreResults = computed(
    () => this.productResults.hasValue() && this.productResults.value().total > productLimit,
  );
  protected readonly pickerPt = innerInputPt;

  constructor() {
    effect(() => {
      this.scope();
      const collection = this.record.hasValue() ? this.record.value() : null;
      this.form.reset({
        name: collection?.name ?? '',
        slug: collection?.slug ?? '',
        active: collection?.active ?? true,
        mode: collection?.mode ?? 'MANUAL',
        categoryId: collection?.categoryId ?? null,
        brandId: collection?.brandId ?? null,
        products: collection?.manualProducts ?? [],
      });
      this.clearSearch();
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
    lockWhileSaving(
      this.picker,
      () => this.saving(),
      () => undefined,
    );
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected error(field: Field): string | null {
    const serverError = this.errors()[field];
    if (serverError || field === 'productIds') {
      return serverError ?? null;
    }
    const control = this.form.controls[field];
    if (!control.touched) {
      return null;
    }
    if (
      (field === 'categoryId' && this.mode() === 'CATEGORY' && !control.value) ||
      (field === 'brandId' && this.mode() === 'BRAND' && !control.value)
    ) {
      return this.shared().validation.required;
    }
    return validationMessage(control.errors, this.language.value());
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

  protected changeMode(): void {
    const { name, slug, active } = this.errors();
    this.errors.set({ name, slug, active });
    this.clearSearch();
  }

  protected searchProducts(query: string): void {
    this.productSearch.set(normalizeSearch(query));
  }

  protected clearSearch(): void {
    this.productSearch.set(null);
    this.picker.reset();
  }

  protected addProduct(value: unknown): void {
    const product = this.suggestions().find((option) => option === value);
    if (product && !this.saving()) {
      this.updateProducts([...this.selectedProducts(), product]);
      this.clearSearch();
    }
  }

  protected moveProduct(index: number, direction: -1 | 1): void {
    const products = [...this.selectedProducts()];
    const next = index + direction;
    const product = products[index];
    const adjacent = products[next];
    if (!product || !adjacent || this.saving()) {
      return;
    }
    products[index] = adjacent;
    products[next] = product;
    this.updateProducts(products);
    const action =
      next + direction >= 0 && next + direction < products.length ? direction : -direction;
    this.focusProductAction(`collection-product-${product.id}-${action === -1 ? 'up' : 'down'}`);
  }

  protected removeProduct(index: number): void {
    const products = this.selectedProducts().filter((_, position) => position !== index);
    this.updateProducts(products);
    const neighbour = products[Math.min(index, products.length - 1)];
    this.focusProductAction(
      neighbour ? `collection-product-${neighbour.id}-remove` : 'collection-products',
    );
  }

  protected productAction(label: string, name: string): string {
    return interpolate(label, { name });
  }

  protected productStatus(status: ProductStatus) {
    const text = this.text();
    return {
      label: status === 'ACTIVE' ? text.active : status === 'DRAFT' ? text.draft : text.archived,
      severity: toneSeverity(
        status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'warn' : 'neutral',
      ),
    };
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const scope = this.scope();
    if (!scope || this.saving() || this.state() !== 'ready' || this.ruleUnavailable()) {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    const { categoryId, brandId, products, ...draft } = this.form.getRawValue();
    if (
      this.form.invalid ||
      (draft.mode === 'CATEGORY' && !categoryId) ||
      (draft.mode === 'BRAND' && !brandId)
    ) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const input: ProductCollectionInput = {
      ...draft,
      ...(draft.mode === 'MANUAL' ? { productIds: products.map(({ id }) => id) } : {}),
      ...(draft.mode === 'CATEGORY' ? { categoryId } : {}),
      ...(draft.mode === 'BRAND' ? { brandId } : {}),
    };
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, input, this.id());
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().collectionSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, field) => {
        if (code === 'DUPLICATE_VALUE' && field === 'slug') {
          return this.text().collectionSlugInUse;
        }
        if (field === 'categoryId' && code !== 'REQUIRED') {
          return this.text().categoryUnavailable;
        }
        if (field === 'brandId' && code !== 'REQUIRED') {
          return this.text().brandUnavailable;
        }
        if (field === 'productIds' && code !== 'DUPLICATE_VALUE') {
          return this.text().collectionProductUnavailable;
        }
        return undefined;
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private updateProducts(products: readonly CollectionProductFieldsFragment[]): void {
    this.form.controls.products.setValue(products);
    this.form.controls.products.markAsDirty();
    this.clearError('productIds');
  }

  private focusProductAction(id: string): void {
    afterNextRender(
      () => {
        this.formElement()?.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (
      !form ||
      !focusFirstInvalid(
        form,
        ['name', 'slug', 'active', 'mode', 'products', 'category', 'brand'],
        'collection-',
      )
    ) {
      this.drawer().focusTitle();
    }
  }
}
