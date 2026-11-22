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
  untracked,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  FormRecord,
  ReactiveFormsModule,
  type AbstractControl,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  formatNumber,
  injectDrawerHost,
  integerValidator,
  interpolate,
  lockWhileSaving,
  normalizeSearch,
  patternValidator,
  searchApplies,
  selectMultiplePt,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { ArrowDownIcon } from 'primeng/icons/arrowdown';
import { ArrowUpIcon } from 'primeng/icons/arrowup';
import { ExclamationTriangleIcon } from 'primeng/icons/exclamationtriangle';
import { SpinnerIcon } from 'primeng/icons/spinner';
import { TrashIcon } from 'primeng/icons/trash';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { BrandsApi } from '../brands/brands-api';
import { CategoriesApi } from '../categories/categories-api';
import { categoryOptions } from '../categories/category-tree';
import type {
  OperatorProductQuery,
  ProductBadgeChoiceFragment,
  ProductImageInput,
  ProductStatus,
  ProductTagChoiceFragment,
  ProductVariantInput,
} from '../generated/products-operations';
import { encodeImage } from '../image-upload';
import { ProductsApi } from './products-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pricePattern = /^\d{1,10}(?:[.,]\d{1,2})?$/;
const productFields = [
  'name',
  'brandId',
  'categoryId',
  'descriptionBg',
  'descriptionEn',
  'badgeIds',
  'tagIds',
] as const;
const variantFields = ['optionValueIds', 'sku', 'price', 'quantity'] as const;
type VariantField = (typeof variantFields)[number];
type Variant = NonNullable<OperatorProductQuery['product']>['variants'][number];

const imageErrorFields = ['Id', 'Upload', 'AltText'] as const;
type ImageErrorField = (typeof imageErrorFields)[number];
type ProductImage = NonNullable<OperatorProductQuery['product']>['images'][number];
const maxImageBytes = 5 * 1024 * 1024;

function imageForm(image: ProductImage | null, file: File | null = null) {
  return new FormGroup({
    id: new FormControl(image?.id ?? null),
    url: new FormControl(image?.url ?? null),
    file: new FormControl(file),
    altText: new FormControl(image?.altText ?? '', { nonNullable: true }),
  });
}

type ImageForm = ReturnType<typeof imageForm>;

function variantForm(variant?: Variant) {
  return new FormGroup({
    id: new FormControl<string | null>(variant?.id ?? null),
    sku: new FormControl(variant?.sku ?? '', {
      nonNullable: true,
      validators: [textValidator(100, { required: true })],
    }),
    price: new FormControl(variant?.price ?? '', {
      nonNullable: true,
      validators: [textValidator(13, { required: true }), patternValidator(pricePattern)],
    }),
    quantity: new FormControl<number | null>(variant?.quantity ?? 0, {
      validators: variant ? [] : [integerValidator(0, 2_147_483_647, { required: true })],
    }),
    inventoryTracked: new FormControl(variant?.inventoryTracked ?? false, { nonNullable: true }),
    active: new FormControl(variant?.active ?? true, { nonNullable: true }),
    optionValueIds: new FormControl<string[]>(variant?.optionValueIds ?? [], { nonNullable: true }),
  });
}

@Component({
  selector: 'holita-product-editor',
  imports: [
    ArrowDownIcon,
    ArrowUpIcon,
    ButtonDirective,
    ExclamationTriangleIcon,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    SpinnerIcon,
    Textarea,
    TrashIcon,
  ],
  templateUrl: './product-editor.html',
  styleUrl: './product-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditor {
  private readonly api = inject(ProductsApi);
  private readonly brandsApi = inject(BrandsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
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
  protected readonly brands = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params, abortSignal }) => this.brandsApi.options(params, abortSignal),
  });
  protected readonly categories = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.categoriesApi.list(params),
  });
  private readonly options = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.api.options(params),
  });
  private readonly specifications = resource({
    params: () => {
      const scope = this.api.scope();
      const productId = this.id();
      return scope && (!this.editing || (productId && uuid.test(productId)))
        ? { scope, productId }
        : undefined;
    },
    loader: ({ params }) => this.api.characteristics(params.scope, params.productId),
  });
  protected readonly specificationGroups = computed(() =>
    this.specifications.hasValue() ? this.specifications.value().groups : [],
  );
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading() || this.options.isLoading() || this.specifications.isLoading()) {
      return 'loading';
    }
    if (this.record.error() || this.options.error() || this.specifications.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly brandOptions = computed(() => [
    { id: null, name: this.text().noBrand },
    ...(this.brands.hasValue() ? this.brands.value() : []),
  ]);
  protected readonly categoryOptions = computed(() =>
    categoryOptions(
      this.categories.hasValue() ? this.categories.value() : [],
      this.text().noCategory,
    ),
  );
  protected readonly optionGroups = computed(() =>
    (this.options.hasValue() ? this.options.value() : [])
      .filter(({ values }) => values.length)
      .map(({ name, values }) => ({
        label: name,
        items: values.map(({ id, label }) => ({ id, label, displayLabel: `${name}: ${label}` })),
      })),
  );
  protected readonly statusOptions = computed(() => [
    { value: 'DRAFT', label: this.text().draft },
    { value: 'ACTIVE', label: this.text().active },
    { value: 'ARCHIVED', label: this.text().archived },
  ]);
  protected readonly variantStatuses = computed(() => [
    { value: true, label: this.text().active },
    { value: false, label: this.text().variantInactive },
  ]);
  protected readonly trackingOptions = computed(() => [
    { value: false, label: this.text().variantUntracked },
    { value: true, label: this.text().variantTracked },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly creatingTag = signal(false);
  protected readonly tagCreateError = signal<string | null>(null);
  protected readonly tagName = new FormControl('', { nonNullable: true });
  private readonly tagSearch = toSignal(
    this.tagName.valueChanges.pipe(map(normalizeSearch), debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly tagSearchInvalid = computed(() => !searchApplies(this.tagSearch()));
  protected readonly badgeChoices = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.api.badges(params),
  });
  protected readonly badgeOptions = computed(() =>
    (this.badgeChoices.hasValue()
      ? this.badgeChoices.value()
      : ((this.record.hasValue() ? this.record.value()?.badges : []) ?? [])
    ).map((badge: ProductBadgeChoiceFragment) => ({
      ...badge,
      label: badge.active ? badge.name : `${badge.name} · ${this.text().optionInactive}`,
    })),
  );
  protected readonly tagResults = resource({
    params: () => {
      const scope = this.api.scope();
      return scope && this.state() === 'ready' && !this.tagSearchInvalid()
        ? { scope, search: this.tagSearch() }
        : undefined;
    },
    loader: ({ params }) => this.api.tags(params.scope, params.search),
  });
  private readonly selectedTags = signal<ProductTagChoiceFragment[]>([]);
  protected readonly tagOptions = computed(() => {
    const options = new Map(this.selectedTags().map((tag) => [tag.id, tag]));
    for (const tag of this.tagResults.hasValue() ? this.tagResults.value() : []) {
      options.set(tag.id, tag);
    }
    return [...options.values()];
  });
  protected readonly characteristicValues = new FormRecord<FormControl<string>>({});
  protected readonly variants = new FormArray([variantForm()]);
  protected readonly images = new FormArray<ImageForm>([]);
  protected readonly previews = signal(new Map<ImageForm, string | null>());
  protected readonly uploadError = signal<
    'productImageInvalid' | 'productImageBatchTooLarge' | null
  >(null);
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    status: new FormControl<ProductStatus>('DRAFT', { nonNullable: true }),
    brandId: new FormControl<string | null>(null),
    categoryId: new FormControl<string | null>(null),
    descriptionBg: new FormControl('', { nonNullable: true }),
    descriptionEn: new FormControl('', { nonNullable: true }),
    badgeIds: new FormControl<string[]>([], { nonNullable: true }),
    tagIds: new FormControl<string[]>([], { nonNullable: true }),
    characteristicValues: this.characteristicValues,
    variants: this.variants,
    images: this.images,
  });

  constructor() {
    effect(() => {
      const scope = this.api.scope();
      const product = this.record.hasValue() ? this.record.value() : null;
      untracked(() => {
        this.releasePreviews();
        this.uploadError.set(null);
        this.images.clear({ emitEvent: false });
        for (const image of product?.images ?? []) {
          const row = imageForm(image);
          this.images.push(row, { emitEvent: false });
          if (scope) {
            void this.loadPreview(row);
          }
        }
      });
      this.variants.clear({ emitEvent: false });
      this.variants.push(product?.variants.map(variantForm) ?? [variantForm()], {
        emitEvent: false,
      });
      this.form.reset(
        {
          name: product?.name ?? '',
          status: product?.status ?? 'DRAFT',
          brandId: product?.brandId ?? null,
          categoryId: product?.categoryId ?? null,
          descriptionBg: product?.descriptionBg ?? '',
          descriptionEn: product?.descriptionEn ?? '',
          badgeIds: product?.badges.map(({ id }) => id) ?? [],
          tagIds: product?.tags.map(({ id }) => id) ?? [],
          characteristicValues: this.characteristicValues.getRawValue(),
          variants: this.variants.getRawValue(),
          images: this.images.getRawValue(),
        },
        { emitEvent: false },
      );
      this.selectedTags.set(product?.tags ?? []);
      this.tagName.reset();
      this.tagCreateError.set(null);
      this.errors.set({});
      this.saveError.set(false);
    });
    effect(() => {
      const specifications = this.specifications.hasValue() ? this.specifications.value() : null;
      const values = new Map(
        specifications?.values.map(({ characteristicId, value }) => [characteristicId, value]),
      );
      for (const id of Object.keys(this.characteristicValues.controls)) {
        this.characteristicValues.removeControl(id, { emitEvent: false });
      }
      for (const group of specifications?.groups ?? []) {
        for (const { id } of group.characteristics) {
          this.characteristicValues.addControl(
            id,
            new FormControl(values.get(id) ?? '', {
              nonNullable: true,
            }),
            { emitEvent: false },
          );
        }
      }
    });
    this.destroyRef.onDestroy(() => {
      this.releasePreviews();
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
    return !this.saving() && !this.creatingTag() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected retry(): void {
    for (const resource of [this.record, this.options, this.specifications]) {
      if (resource.error()) {
        resource.reload();
      }
    }
  }

  protected controlError(control: AbstractControl, path: string): string | null {
    return (
      this.errors()[path] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected variantError(index: number, field: VariantField): string | null {
    return this.controlError(this.variants.at(index).controls[field], this.path(index, field));
  }

  protected selectPt(error: string | null, id: string, multiple = false) {
    return {
      label: {
        ...(multiple ? selectMultiplePt.label : {}),
        'aria-describedby': id + '-error',
        'aria-invalid': error ? 'true' : undefined,
      },
      option: { style: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
      optionGroup: { style: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
    };
  }

  protected path(index: number, field: string): string {
    return `variants.${String(index)}.${field}`;
  }

  protected indexedLabel(template: string, index: number): string {
    return interpolate(template, { number: formatNumber(index + 1, this.language.value()) });
  }

  protected clearError(path: string): void {
    this.errors.update((errors) => ({
      ...errors,
      [path]: undefined,
      ...(path.startsWith('variants.') ? { variants: undefined } : {}),
    }));
  }

  protected changeOptionValues(index: number, picker: Select, event: Event | undefined): void {
    this.clearError(this.path(index, 'optionValueIds'));
    if (event?.type === 'click') {
      picker.focus();
    }
  }

  protected changeMarkers(
    field: 'badgeIds' | 'tagIds',
    picker: Select,
    event: Event | undefined,
  ): void {
    this.clearError(field);
    if (field === 'tagIds') {
      const ids = new Set(this.form.controls.tagIds.value);
      this.selectedTags.set(this.tagOptions().filter(({ id }) => ids.has(id)));
    }
    if (event?.type === 'click') {
      picker.focus();
    }
  }

  protected async addTag(): Promise<void> {
    const scope = this.api.scope();
    const name = this.tagName.value.trim();
    if (!scope || !name || this.saving() || this.creatingTag()) {
      return;
    }
    this.tagCreateError.set(null);
    this.creatingTag.set(true);
    try {
      const tag = await this.api.addTag(scope, name);
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const control = this.form.controls.tagIds;
      this.selectedTags.update((tags) => [...tags, tag]);
      control.setValue([...control.value, tag.id]);
      control.markAsDirty();
      this.clearError('tagIds');
      this.tagName.reset();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, ['name'], scope.language, (code) =>
        code === 'DUPLICATE_VALUE' ? this.text().productTagNameInUse : undefined,
      );
      this.tagCreateError.set(errors.name ?? this.text().tagCreateFailed);
    } finally {
      this.creatingTag.set(false);
      if (!this.destroyRef.destroyed && this.api.scope() === scope) {
        this.focusControl('product-tag-search');
      }
    }
  }

  protected chooseImages(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) {
      return;
    }
    if (
      files.some(
        (file) =>
          !file.size ||
          file.size > maxImageBytes ||
          (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)),
      )
    ) {
      this.rejectImageBatch('productImageInvalid');
      return;
    }
    const bytes = this.images.controls.reduce(
      (total, row) => total + (row.controls.file.value?.size ?? 0),
      0,
    );
    if (files.reduce((total, file) => total + file.size, bytes) > maxImageBytes) {
      this.rejectImageBatch('productImageBatchTooLarge');
      return;
    }
    this.uploadError.set(null);
    for (const file of files) {
      const row = imageForm(null, file);
      this.images.push(row);
      this.setPreview(row, URL.createObjectURL(file));
    }
    this.images.markAsDirty();
    this.clearError('images');
  }

  private rejectImageBatch(error: 'productImageInvalid' | 'productImageBatchTooLarge'): void {
    this.uploadError.set(error);
    this.focusControl('product-image-add');
  }

  protected dismissImageBatch(): void {
    this.uploadError.set(null);
    this.focusControl('product-image-add');
  }

  protected async loadPreview(row: ImageForm): Promise<void> {
    const scope = this.api.scope();
    const url = row.controls.url.value;
    if (!scope || !url) {
      return;
    }
    this.releasePreview(row);
    try {
      const blob = await this.api.image(scope, url);
      if (
        this.api.scope() === scope &&
        this.images.controls.includes(row) &&
        !this.destroyRef.destroyed
      ) {
        this.setPreview(row, URL.createObjectURL(blob));
      }
    } catch {
      if (
        this.api.scope() === scope &&
        this.images.controls.includes(row) &&
        !this.destroyRef.destroyed
      ) {
        this.setPreview(row, null);
      }
    }
  }

  protected previewFailed(row: ImageForm): void {
    this.releasePreview(row);
    this.setPreview(row, null);
  }

  private setPreview(row: ImageForm, url: string | null): void {
    this.previews.update((current) => new Map(current).set(row, url));
  }

  private releasePreview(row: ImageForm): void {
    const url = this.previews().get(row);
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.previews.update((current) => {
      const remaining = new Map(current);
      remaining.delete(row);
      return remaining;
    });
  }

  private releasePreviews(): void {
    for (const url of this.previews().values()) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
    this.previews.set(new Map());
  }

  protected imageErrorPath(index: number, field: ImageErrorField): string {
    return `image${String(index)}${field}`;
  }

  protected imageAttachmentError(index: number): string | undefined {
    const errors = this.errors();
    return errors[this.imageErrorPath(index, 'Upload')] ?? errors[this.imageErrorPath(index, 'Id')];
  }

  protected moveImage(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const row = this.images.at(index);
    this.images.removeAt(index);
    this.images.insert(target, row);
    this.imagesChanged();
    const canContinue = target + direction >= 0 && target + direction < this.images.length;
    this.focusControl(
      `product-image-${String(target)}-${(canContinue ? direction : -direction) < 0 ? 'up' : 'down'}`,
    );
  }

  protected removeImage(index: number): void {
    this.releasePreview(this.images.at(index));
    this.images.removeAt(index);
    this.imagesChanged();
    this.focusControl('product-image-add');
  }

  private imagesChanged(): void {
    this.images.markAsDirty();
    this.errors.update((errors) =>
      Object.fromEntries(Object.entries(errors).filter(([path]) => !path.startsWith('image'))),
    );
  }

  protected addVariant(): void {
    this.variants.push(variantForm());
    this.variantsChanged('product-variant-values-' + String(this.variants.length - 1));
  }

  protected changeTracking(index: number): void {
    const { id, inventoryTracked, quantity } = this.variants.at(index).controls;
    if (!id.value && !inventoryTracked.value) {
      quantity.reset(0);
      this.clearError(this.path(index, 'quantity'));
    }
  }

  protected quantityText(quantity: number | null): string {
    return formatNumber(quantity, this.language.value());
  }

  protected removeVariant(index: number): void {
    this.variants.removeAt(index);
    this.variantsChanged('product-add-variant');
  }

  private variantsChanged(focusId: string): void {
    this.variants.markAsDirty();
    this.errors.update((errors) =>
      Object.fromEntries(
        Object.entries(errors).filter(
          ([path]) => path !== 'variants' && !path.startsWith('variants.'),
        ),
      ),
    );
    this.focusControl(focusId);
  }

  private focusControl(focusId: string): void {
    afterNextRender(
      () => {
        const control = this.formElement()?.nativeElement.querySelector<HTMLElement>('#' + focusId);
        control?.focus();
        control?.closest('.product-image-picker')?.scrollIntoView({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.creatingTag() || this.state() !== 'ready') {
      return;
    }
    if (this.uploadError()) {
      this.focusControl('product-image-add');
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
    const { variants, images, characteristicValues, ...draft } = this.form.getRawValue();
    const specifications = Object.entries(characteristicValues)
      .filter(([id]) => this.characteristicValues.controls[id]?.dirty)
      .map(([characteristicId, value]) => ({ characteristicId, value }));
    const recordId = this.id();
    const galleryChanged = this.images.dirty;
    const input: ProductVariantInput[] = variants.map(({ id, quantity, price, ...variant }) => ({
      ...variant,
      ...(id ? { id } : {}),
      price: price.replace(',', '.'),
      ...(!id && variant.inventoryTracked ? { quantity: quantity ?? 0 } : {}),
    }));
    this.saving.set(true);
    try {
      const gallery: ProductImageInput[] = [];
      if (galleryChanged) {
        for (const { id, file, altText } of images) {
          gallery.push(
            id ? { id, altText } : { upload: file ? await encodeImage(file) : null, altText },
          );
        }
      }
      const id = await this.api.save(
        scope,
        {
          ...draft,
          variants: input,
          ...(specifications.length ? { characteristicValues: specifications } : {}),
          ...(galleryChanged ? { images: gallery } : {}),
        },
        recordId,
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().productSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const fields = [
        ...productFields,
        'images',
        ...images.flatMap((_, index) =>
          imageErrorFields.map((field) => this.imageErrorPath(index, field)),
        ),
        ...specifications.flatMap((_, index) =>
          ['characteristicId', 'value'].map(
            (field) => `characteristicValues.${String(index)}.${field}`,
          ),
        ),
        'variants',
        ...variants.flatMap((_, index) =>
          [...variantFields, 'id'].map((field) => this.path(index, field)),
        ),
      ];
      const messages: Record<string, string> = {
        DUPLICATE_SKU: this.text().variantDuplicateSku,
        DUPLICATE_COMBINATION: this.text().variantDuplicateCombination,
        INVALID_OPTION_VALUES: this.text().variantInvalidValues,
        MISMATCHED_OPTIONS: this.text().variantMismatchedOptions,
        INVALID_GALLERY: this.text().productImageInvalid,
        INVALID_IMAGE: this.text().productImageInvalid,
        IMAGE_BATCH_TOO_LARGE: this.text().productImageBatchTooLarge,
        INVALID_ALT_TEXT: this.text().productImageAltInvalid,
        INVALID_IMAGE_ID: this.text().productImageIdInvalid,
      };
      const errors = fieldErrors(error, fields, scope.language, (code, path) => {
        if (path === 'brandId') {
          return this.text().brandUnavailable;
        }
        if (path === 'categoryId') {
          return this.text().categoryUnavailable;
        }
        if (path === 'descriptionBg' || path === 'descriptionEn') {
          return this.text().productDescriptionInvalid;
        }
        if (path === 'badgeIds') {
          return this.text().productBadgeUnavailable;
        }
        if (path === 'tagIds') {
          return this.text().productTagUnavailable;
        }
        if (path.startsWith('characteristicValues.')) {
          return path.endsWith('.characteristicId')
            ? this.text().characteristicUnavailable
            : this.text().characteristicValueInvalid;
        }
        if (path.startsWith('variants.') && path.endsWith('.id')) {
          return this.text().variantUnavailable;
        }
        return messages[code];
      });
      for (const [index, { characteristicId }] of specifications.entries()) {
        const path = `characteristicValues.${String(index)}`;
        const message = errors[`${path}.characteristicId`] ?? errors[`${path}.value`];
        if (message) {
          errors[characteristicId] = message;
        }
      }
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    const attachmentIndex = this.images.controls.findIndex((_, index) =>
      this.imageAttachmentError(index),
    );
    if (form && attachmentIndex >= 0) {
      const remove = form.querySelector<HTMLElement>(
        `#product-image-${String(attachmentIndex)}-remove`,
      );
      remove?.focus();
      remove?.closest('.product-image-card')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const order = [
      'name',
      'brand',
      'category',
      'description-bg',
      'description-en',
      'badges',
      'tags',
      ...Object.keys(this.characteristicValues.controls).map((id) => `specification-${id}`),
      'image-add',
      ...this.images.controls.map((_, index) => `image-alt-${String(index)}`),
      ...this.variants.controls.flatMap((_, index) =>
        ['values', 'sku', 'price', 'quantity'].map((field) => `variant-${field}-${String(index)}`),
      ),
    ];
    if (form && focusFirstInvalid(form, order, 'product-')) {
      form.ownerDocument.activeElement
        ?.closest('.product-image-card')
        ?.scrollIntoView({ block: 'nearest' });
    } else {
      this.drawer().focusTitle();
    }
  }
}
