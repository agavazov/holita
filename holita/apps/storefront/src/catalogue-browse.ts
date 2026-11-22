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
} from './catalogue-url';
import { hasLongBadge } from './product-display';
import { StorefrontApi } from './storefront-api';
import { messages, type Language } from './storefront-messages';

@Component({
  selector: 'holita-catalogue-browse',
  imports: [NgTemplateOutlet, RouterLink],
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
  readonly language = input.required<Language>();
  readonly section = input.required<BrowseSection | null>();

  protected readonly slug = computed(() => this.params().get('slug'));
  protected readonly indexSection = computed(() => (this.slug() === null ? this.section() : null));
  protected readonly url = computed(() => parseCatalogueUrl(this.query()));
  protected readonly base = computed(() => ['/s', this.shopId()]);
  protected readonly draft = linkedSignal(() => this.url().filters);
  protected readonly invalidDraft = linkedSignal({ source: this.url, computation: () => false });
  protected readonly filtersOpen = signal(false);
  protected readonly sortChoices = sortChoices;
  protected readonly t = computed(() => messages[this.language()]);
  protected readonly hasLongBadge = hasLongBadge;
  protected readonly format = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: 'BGN' }),
  );

  private readonly products = resource({
    params: () => {
      const { filters, page, valid } = this.url();
      return !this.indexSection() && valid
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
  protected readonly pageSize = cataloguePageSize;
  protected readonly filtered = computed(() => hasFilters(this.url().filters));
  protected readonly canClear = computed(
    () => this.filtered() || Boolean(this.url().filters.sort) || !this.url().valid,
  );
  protected readonly selectedCount = computed(() => {
    const { q, minPrice, maxPrice, brand, option, inStock } = this.url().filters;
    return (
      Number(Boolean(q)) +
      Number(Boolean(minPrice || maxPrice)) +
      brand.length +
      option.length +
      Number(inStock)
    );
  });
  protected readonly staleChoices = computed(() => {
    const facets = this.result()?.facets;
    const { brand, option } = this.url().filters;
    return Boolean(
      facets &&
      (brand.some((id) => !facets.brands.some((entry) => entry.id === id)) ||
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
          queryParams: catalogueParams(
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

  protected toggleFilters() {
    this.filtersOpen.update((open) => !open);
  }

  protected update(field: 'q' | 'minPrice' | 'maxPrice' | 'sort', value: string) {
    this.draft.update((filters) => ({ ...filters, [field]: value }));
  }

  protected changeBrand(id: string, checked: boolean) {
    this.draft.update((filters) => ({
      ...filters,
      brand: checked ? [...filters.brand, id] : filters.brand.filter((item) => item !== id),
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

  protected apply(event: Event) {
    event.preventDefault();
    if (!validCatalogueFilters(this.draft())) {
      this.invalidDraft.set(true);
      return;
    }
    this.invalidDraft.set(false);
    this.filtersOpen.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: catalogueParams(this.draft(), 1),
    });
  }

  protected clear() {
    this.draft.set(emptyFilters());
    this.invalidDraft.set(false);
    void this.router.navigate([], { relativeTo: this.route });
  }

  protected paging(page: number) {
    return catalogueParams(this.indexSection() ? emptyFilters() : this.url().filters, page);
  }

  protected retry() {
    if (this.indexSection()) {
      this.entries.reload();
    } else {
      this.products.reload();
    }
  }
}
