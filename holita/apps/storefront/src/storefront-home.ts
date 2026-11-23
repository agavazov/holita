import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { newestCatalogueSort } from './catalogue-url';
import type { CatalogueBrowsePageFragment } from './generated/operations';
import { StorefrontApi } from './storefront-api';
import { localizedText } from './storefront-content';
import { messages, type Language } from './storefront-messages';

interface Shelf {
  name: string;
  slug: string;
  items: CatalogueBrowsePageFragment['items'];
}

const collectionLimit = 4;
const collectionIndexLimit = 100;
const preview = { offset: 0, limit: 4 };

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
  private readonly router = inject(Router);
  readonly shopId = input.required<string>();
  readonly shopName = input.required<string>();
  readonly language = input.required<Language>();
  readonly format = input.required<Pick<Intl.NumberFormat, 'format'>>();
  protected readonly t = computed(() => messages[this.language()]);
  protected readonly base = computed(() => ['/s', this.shopId()]);
  protected readonly newestParams = { sort: newestCatalogueSort };

  protected readonly appearance = resource({
    params: this.shopId,
    loader: ({ params: shopId }) => this.api.shopHome(shopId),
  });
  private readonly custom = computed(() =>
    this.appearance.hasValue() ? this.appearance.value() : null,
  );
  protected readonly products = resource({
    params: () =>
      this.appearance.isLoading()
        ? undefined
        : {
            shopId: this.shopId(),
            showLatest: this.custom()?.showLatestProducts ?? true,
          },
    loader: async ({ params: { shopId, showLatest }, abortSignal }) => {
      const collections: Shelf[] = [];
      // Empty public collections do not take the place of a populated shelf.
      for (let offset = 0; offset < collectionIndexLimit; offset += collectionLimit) {
        const { items, total } = await this.api.index(shopId, 'collections', {
          offset,
          limit: collectionLimit,
        });
        abortSignal.throwIfAborted();
        const batch = await Promise.all(
          items.map(async ({ name, slug }) => ({
            name,
            slug,
            items: (await this.api.listing(shopId, 'collections', slug, preview))?.items ?? [],
          })),
        );
        abortSignal.throwIfAborted();
        collections.push(...batch.filter(({ items }) => items.length));
        if (collections.length >= collectionLimit || offset + items.length >= total) {
          break;
        }
      }
      const latest =
        !collections.length && showLatest
          ? await this.api.listing(shopId, null, null, { ...preview, sort: 'NEWEST' })
          : null;
      return { collections: collections.slice(0, collectionLimit), latest };
    },
  });
  protected readonly shelves = computed(() => {
    const result = this.products.hasValue() ? this.products.value() : null;
    if (!result) {
      return [];
    }
    if (result.collections.length) {
      return result.collections.map((shelf, index) => ({
        ...shelf,
        layout: ['classic', 'catalog', 'editorial'][index % 3],
      }));
    }
    return result.latest
      ? [
          {
            name: this.t().newestProducts,
            slug: null,
            items: result.latest.items,
            layout: 'classic',
          },
        ]
      : [];
  });

  protected readonly hero = computed(() => {
    const home = this.custom();
    return {
      title: home
        ? (this.text(home.welcomeBg, home.welcomeEn) ?? this.shopName())
        : this.t().seasonTitle,
      label: this.text(home?.heroActionBg, home?.heroActionEn) ?? this.t().browseProducts,
      link: this.link(home ? home.heroHref : '/products'),
      image: home?.heroImageUrl ?? '/storefront-basic/images/placeholders/home-hero.svg',
    };
  });

  protected readonly tiles = computed(() => {
    const home = this.custom();
    if (home?.showTiles === false) {
      return [];
    }
    const defaults = [
      { title: this.t().newArrivals, href: '/products?sort=' + newestCatalogueSort },
      { title: this.t().categories, href: '/categories' },
      { title: this.t().collections, href: '/collections' },
    ];
    return defaults.flatMap((fallback, index) => {
      const tile = home?.tiles[index];
      const title = tile ? this.text(tile.titleBg, tile.titleEn) : fallback.title;
      if (!title) {
        return [];
      }
      return [
        {
          index,
          title,
          eyebrow: tile ? this.text(tile.eyebrowBg, tile.eyebrowEn) : this.t().explore,
          alt: this.text(tile?.imageAltBg, tile?.imageAltEn) ?? '',
          link: this.link(tile ? tile.href : fallback.href),
          image:
            tile?.imageUrl ??
            '/storefront-basic/images/placeholders/home-tile-' + String(index + 1) + '.svg',
        },
      ];
    });
  });

  protected readonly highlights = computed(() => {
    const home = this.custom();
    if (home?.showBenefits === false) {
      return [];
    }
    const t = this.t();
    const defaults = [
      {
        title: t.categories,
        description: t.categoriesDescription,
        icon: 'categories',
        href: '/categories',
      },
      {
        title: t.collections,
        description: t.collectionsDescription,
        icon: 'collections',
        href: '/collections',
      },
      {
        title: t.accountOrders,
        description: t.accountDescription,
        icon: 'account',
        href: '/account/orders',
      },
      { title: t.help, description: t.helpDescription, icon: 'contacts', href: '/contacts' },
    ];
    return defaults.flatMap((fallback, index) => {
      const benefit = home?.benefits[index];
      if (!benefit) {
        return [
          {
            index,
            title: fallback.title,
            description: fallback.description,
            icon: fallback.icon,
            link: this.link(fallback.href),
          },
        ];
      }
      const title = this.text(benefit.titleBg, benefit.titleEn);
      const description = this.text(benefit.descriptionBg, benefit.descriptionEn);
      return title && description
        ? [
            {
              index,
              title,
              description,
              icon: benefit.icon,
              link: null,
            },
          ]
        : [];
    });
  });

  private text(bg: string | null | undefined, en: string | null | undefined) {
    return localizedText(this.language(), bg, en);
  }

  private link(href: string | null) {
    return href ? this.router.parseUrl('/s/' + encodeURIComponent(this.shopId()) + href) : null;
  }
}
