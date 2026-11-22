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
import {
  FormArray,
  FormControl,
  FormGroup,
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
  patternValidator,
  selectMultiplePt,
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
import { BrandsApi } from '../brands/brands-api';
import { CategoriesApi } from '../categories/categories-api';
import { categoryOptions } from '../categories/category-tree';
import type {
  OperatorProductQuery,
  ProductStatus,
  ProductVariantInput,
} from '../generated/products-operations';
import { ProductsApi } from './products-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pricePattern = /^\d{1,10}(?:[.,]\d{1,2})?$/;
const productFields = ['name', 'brandId', 'categoryId', 'descriptionBg', 'descriptionEn'] as const;
const variantFields = ['optionValueIds', 'sku', 'price', 'quantity'] as const;
type VariantField = (typeof variantFields)[number];
type Variant = NonNullable<OperatorProductQuery['product']>['variants'][number];

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
      validators: [integerValidator(0, 2_147_483_647, { required: true })],
    }),
    inventoryTracked: new FormControl(variant?.inventoryTracked ?? false, { nonNullable: true }),
    active: new FormControl(variant?.active ?? true, { nonNullable: true }),
    optionValueIds: new FormControl<string[]>(variant?.optionValueIds ?? [], { nonNullable: true }),
  });
}

@Component({
  selector: 'holita-product-editor',
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
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading() || this.options.isLoading()) {
      return 'loading';
    }
    if (this.record.error() || this.options.error()) {
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
  protected readonly variants = new FormArray([variantForm()]);
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
    variants: this.variants,
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const product = this.record.hasValue() ? this.record.value() : null;
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
          variants: this.variants.getRawValue(),
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

  protected retry(): void {
    for (const resource of [this.record, this.options]) {
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
    this.errors.update((errors) => ({ ...errors, [path]: undefined, variants: undefined }));
  }

  protected changeOptionValues(index: number, picker: Select, event: Event | undefined): void {
    this.clearError(this.path(index, 'optionValueIds'));
    if (event?.type === 'click') {
      picker.focus();
    }
  }

  protected addVariant(): void {
    this.variants.push(variantForm());
    this.variantsChanged('product-variant-values-' + String(this.variants.length - 1));
  }

  protected removeVariant(index: number): void {
    this.variants.removeAt(index);
    this.variantsChanged('product-add-variant');
  }

  private variantsChanged(focusId: string): void {
    this.variants.markAsDirty();
    this.errors.update((errors) =>
      Object.fromEntries(productFields.map((field) => [field, errors[field]] as const)),
    );
    afterNextRender(
      () => {
        this.formElement()
          ?.nativeElement.querySelector<HTMLElement>('#' + focusId)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
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
    const { variants, ...draft } = this.form.getRawValue();
    const input: ProductVariantInput[] = variants.map(({ id, quantity, price, ...variant }) => ({
      ...variant,
      ...(id ? { id } : {}),
      price: price.replace(',', '.'),
      quantity: quantity ?? 0,
    }));
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, { ...draft, variants: input }, this.id());
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
        if (path.endsWith('.id')) {
          return this.text().variantUnavailable;
        }
        return messages[code];
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    const order = [
      'name',
      'brand',
      'category',
      'description-bg',
      'description-en',
      ...this.variants.controls.flatMap((_, index) =>
        ['values', 'sku', 'price', 'quantity'].map((field) => `variant-${field}-${String(index)}`),
      ),
    ];
    if (!form || !focusFirstInvalid(form, order, 'product-')) {
      this.drawer().focusTitle();
    }
  }
}
