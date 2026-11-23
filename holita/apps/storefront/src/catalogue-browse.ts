import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  cataloguePageSize,
  catalogueParams,
  catalogueVariables,
  emptyFilters,
  hasFilters,
  parseCatalogueUrl,
  sortChoices,
  validCatalogueFilters,
  type BrowseSection,
  type CatalogueFilters,
} from './catalogue-url';
import { StorefrontApi } from './storefront-api';
import { StorefrontHome } from './storefront-home';
import { messages, type Language } from './storefront-messages';
import { shopCurrency } from './storefront-money';

@Component({
  selector: 'holita-catalogue-browse',
  imports: [NgTemplateOutlet, RouterLink, StorefrontHome],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogue-browse.html',
  styleUrl: './catalogue-browse.scss',
})
export class CatalogueBrowse {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StorefrontApi);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly shopId = input.required<string>();
  readonly shopName = input.required<string>();
  readonly language = input.required<Language>();
  readonly section = input.required<BrowseSection | null>();
  readonly landing = input(false);

  protected readonly slug = computed(() => this.params().get('slug'));
  protected readonly indexSection = computed(() => (this.slug() === null ? this.section() : null));
  protected readonly url = computed(() => parseCatalogueUrl(this.query()));
  protected readonly home = computed(() => {
    const { valid, filters } = this.url();
    return (
      this.landing() && valid && !this.query().has('page') && !filters.sort && !hasFilters(filters)
    );
  });
  protected readonly base = computed(() => ['/s', this.shopId()]);
  protected readonly draft = linkedSignal(() => this.url().filters);
  protected readonly invalidDraft = linkedSignal({ source: this.url, computation: () => false });
  protected readonly filtersOpen = signal(false);
  protected readonly sortChoices = sortChoices;
  protected readonly t = computed(() => messages[this.language()]);
  protected readonly format = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: shopCurrency }),
  );

  private readonly products = resource({
    params: () => {
      const { filters, page, valid } = this.url();
      return !this.home() && !this.indexSection() && valid
        ? {
            shopId: this.shopId(),
            section: this.section(),
            slug: this.slug(),
            variables: catalogueVariables(filters, page),
          }
        : undefined;
    },
    loader: ({ params }) =>
      this.api.listing(params.shopId, params.section, params.slug, params.variables),
  });
  private readonly entries = resource({
    params: () => {
      const section = this.indexSection();
      const page = section === 'categories' ? 1 : this.url().page;
      return section ? { shopId: this.shopId(), section, page } : undefined;
    },
    loader: ({ params }) =>
      this.api.index(params.shopId, params.section, {
        offset: (params.page - 1) * cataloguePageSize,
        limit: cataloguePageSize,
      }),
  });
  protected readonly result = computed(() =>
    this.products.hasValue() ? this.products.value() : undefined,
  );
  protected readonly index = computed(() =>
    this.entries.hasValue() ? this.entries.value() : undefined,
  );
  protected readonly isLoading = computed(
    () => this.products.isLoading() || this.entries.isLoading(),
  );
  protected readonly minEnd = computed(() =>
    Math.min(this.url().page * cataloguePageSize, this.total()),
  );
  protected readonly failed = computed(
    () => this.products.status() === 'error' || this.entries.status() === 'error',
  );
  protected readonly total = computed(() => this.result()?.total ?? this.index()?.total ?? 0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / cataloguePageSize)),
  );
  protected readonly visiblePages = computed(() => {
    const start = Math.max(1, this.url().page - 1);
    const end = Math.min(this.pageCount(), this.url().page + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  protected readonly pageSize = cataloguePageSize;
  protected readonly filtered = computed(() => hasFilters(this.url().filters));
  protected readonly canClear = computed(
    () => this.filtered() || Boolean(this.url().filters.sort) || !this.url().valid,
  );
  protected readonly selectedCount = computed(() => {
    const { q, minPrice, maxPrice, brand, characteristic, option, tag, inStock } =
      this.url().filters;
    return (
      Number(Boolean(q)) +
      Number(Boolean(minPrice || maxPrice)) +
      brand.length +
      characteristic.length +
      option.length +
      tag.length +
      Number(inStock)
    );
  });
  protected readonly staleChoices = computed(() => {
    const facets = this.result()?.facets;
    const { brand, characteristic, option, tag } = this.url().filters;
    return Boolean(
      facets &&
      (brand.some((id) => !facets.brands.some((entry) => entry.id === id)) ||
        characteristic.some(
          (id) =>
            !facets.characteristicFacets.some((group) =>
              group.characteristics.some((field) => field.choices.some((entry) => entry.id === id)),
            ),
        ) ||
        tag.some((id) => !facets.tags.some((entry) => entry.id === id)) ||
        option.some(
          (id) => !facets.options.some((group) => group.values.some((entry) => entry.id === id)),
        )),
    );
  });
  protected readonly categoryChildren = computed(() => {
    const siblings = new Map<string, NonNullable<ReturnType<typeof this.index>>['items']>();
    for (const category of this.index()?.categories ?? []) {
      if (category.parentId) {
        const children = siblings.get(category.parentId) ?? [];
        children.push(category);
        siblings.set(category.parentId, children);
      }
    }
    return siblings;
  });

  constructor() {
    effect(() => {
      if (this.indexSection() === 'categories' || (!this.index() && !this.result())) {
        return;
      }
      const { page, filters } = this.url();
      if (page > this.pageCount()) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.browseParams(
            this.indexSection() ? emptyFilters() : filters,
            this.pageCount(),
          ),
          replaceUrl: true,
        });
      }
    });
  }

  protected isSelected(group: readonly { id: string }[]) {
    return group.some(({ id }) => this.draft().option.includes(id));
  }

  protected openFilters(dialog: HTMLDialogElement) {
    this.filtersOpen.set(true);
    dialog.showModal();
  }

  protected closeFilters(dialog: HTMLDialogElement) {
    this.filtersOpen.set(false);
    dialog.close();
  }

  protected update(field: 'q' | 'minPrice' | 'maxPrice', value: string) {
    this.draft.update((filters) => ({ ...filters, [field]: value }));
  }

  protected sortBy(sort: string) {
    const filters = { ...this.draft(), sort };
    this.draft.set(filters);
    if (!validCatalogueFilters(filters)) {
      this.invalidDraft.set(true);
      return;
    }
    this.invalidDraft.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.browseParams(filters, 1),
    });
  }

  protected changeBrand(id: string, checked: boolean) {
    this.draft.update((filters) => ({
      ...filters,
      brand: checked ? [...filters.brand, id] : filters.brand.filter((item) => item !== id),
    }));
  }

  protected changeTag(id: string, checked: boolean) {
    this.draft.update((filters) => ({
      ...filters,
      tag: checked ? [...filters.tag, id] : filters.tag.filter((item) => item !== id),
    }));
  }

  protected changeOption(value: string, group: readonly { id: string }[]) {
    this.draft.update((filters) => ({
      ...filters,
      option: [
        ...filters.option.filter((id) => !group.some((item) => item.id === id)),
        ...(value ? [value] : []),
      ],
    }));
  }

  protected changeStock(inStock: boolean) {
    this.draft.update((filters) => ({ ...filters, inStock }));
  }

  protected changeCharacteristic(id: string, checked: boolean) {
    this.draft.update((filters) => ({
      ...filters,
      characteristic: checked
        ? [...filters.characteristic, id]
        : filters.characteristic.filter((item) => item !== id),
    }));
  }

  protected apply(event: Event, dialog: HTMLDialogElement) {
    event.preventDefault();
    if (!validCatalogueFilters(this.draft())) {
      this.invalidDraft.set(true);
      return;
    }
    this.invalidDraft.set(false);
    this.closeFilters(dialog);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.browseParams(this.draft(), 1),
    });
  }

  protected clear() {
    const filters = emptyFilters();
    this.draft.set(filters);
    this.invalidDraft.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.browseParams(filters, 1),
    });
  }

  protected paging(page: number) {
    return this.browseParams(this.indexSection() ? emptyFilters() : this.url().filters, page);
  }

  protected retry() {
    if (this.indexSection()) {
      this.entries.reload();
    } else {
      this.products.reload();
    }
  }

  private browseParams(filters: CatalogueFilters, page: number) {
    const params = catalogueParams(filters, page);
    return this.landing() && page === 1 && !filters.sort && !hasFilters(filters)
      ? { ...params, page }
      : params;
  }
}
