import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CatalogueBrowsePageFragment } from './generated/operations';
import { StorefrontApi } from './storefront-api';
import { messages, type Language } from './storefront-messages';

@Component({
  selector: 'holita-storefront-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-home-layout': 'overlappingImageTilesAndPerks' },
  templateUrl: './storefront-home.html',
  styleUrl: './storefront-home.scss',
})
export class StorefrontHome {
  private readonly api = inject(StorefrontApi);
  readonly shopId = input.required<string>();
  readonly language = input.required<Language>();
  readonly catalogue = input<CatalogueBrowsePageFragment | null>();
  readonly loading = input.required<boolean>();
  readonly failed = input.required<boolean>();

  protected readonly t = computed(() => messages[this.language()]);
  protected readonly base = computed(() => ['/s', this.shopId()]);
  protected readonly format = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: 'BGN' }),
  );
  private readonly collections = resource({
    params: this.shopId,
    loader: async ({ params: shopId, abortSignal }) => {
      const { items } = await this.api.index(shopId, 'collections', { offset: 0, limit: 4 });
      abortSignal.throwIfAborted();
      const lists = await Promise.all(
        items.map(({ name, slug }) =>
          this.api
            .listing(shopId, 'collections', slug, { offset: 0, limit: 4 })
            .then((result) => ({ name, slug, items: result?.items ?? [] })),
        ),
      );
      return lists.filter(({ items }) => items.length);
    },
  });
  protected readonly shelves = computed(() => {
    if (this.collections.isLoading()) {
      return [];
    }
    const collections = this.collections.hasValue() ? this.collections.value() : [];
    if (collections.length) {
      return collections;
    }
    return [
      {
        name: this.t().productSelection,
        slug: null,
        items: this.catalogue()?.items.slice(0, 4) ?? [],
      },
    ];
  });
  protected readonly tiles = [
    { label: 'productSelection', section: 'products' },
    { label: 'categories', section: 'categories' },
    { label: 'collections', section: 'collections' },
  ] as const;
  protected readonly highlights = [
    { label: 'categories', description: 'categoriesDescription', section: 'categories' },
    { label: 'collections', description: 'collectionsDescription', section: 'collections' },
    { label: 'accountOrders', description: 'accountDescription', section: 'account' },
    { label: 'help', description: 'helpDescription', section: 'contacts' },
  ] as const;
}
