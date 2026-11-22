import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { Apollo, provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { Tag } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { toneSeverity, type StatusTone } from '@osnova/ui';
import { loadLocalConfig, readPrimeUiLicense } from '@osnova/ui/app';
import { Appearance, appTheme, provideOsnovaTheme } from '@osnova/ui/theme';
import {
  CatalogueDocument,
  CatalogueProductDocument,
  PublicShopDocument,
  RegisterShopperDocument,
  ShopperMeDocument,
  SignInShopperDocument,
  SignOutShopperDocument,
  type CatalogueBadgeColor,
  type CatalogueQuery,
  type CatalogueProductQuery,
  type ShopperMeQuery,
} from './generated/operations';

const messages = {
  bg: {
    products: 'Продукти',
    account: 'Моят профил',
    navigation: 'Навигация в магазина',
    pagination: 'Страници с продукти',
    count: (total: number) => (total === 1 ? '1 продукт' : `${String(total)} продукта`),
    signIn: 'Вход',
    register: 'Регистрация',
    signOut: 'Изход',
    name: 'Име',
    email: 'Имейл',
    password: 'Парола',
    shopMissing: 'Магазинът не е намерен.',
    error: 'Заявката не беше успешна.',
    empty: 'Няма продукти.',
    previous: 'Предишна',
    next: 'Следваща',
    back: 'Към продуктите',
    productPath: 'Път до продукта',
    productGallery: 'Снимки на продукта',
    productTags: 'Етикети',
    specifications: 'Характеристики',
    inStock: 'В наличност',
    outOfStock: 'Изчерпан',
    productImageNumber: (number: number) => `Снимка ${String(number)}`,
    loading: 'Зареждане…',
    productMissing: 'Продуктът не е намерен.',
    retry: 'Опитай отново',
  },
  en: {
    products: 'Products',
    account: 'My account',
    navigation: 'Shop navigation',
    pagination: 'Product pages',
    count: (total: number) => (total === 1 ? '1 product' : `${String(total)} products`),
    signIn: 'Sign in',
    register: 'Register',
    signOut: 'Sign out',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    shopMissing: 'Shop not found.',
    error: 'The request could not be completed.',
    empty: 'No products.',
    previous: 'Previous',
    next: 'Next',
    back: 'Back to products',
    productPath: 'Product breadcrumbs',
    productGallery: 'Product photos',
    productTags: 'Tags',
    specifications: 'Specifications',
    inStock: 'In stock',
    outOfStock: 'Out of stock',
    productImageNumber: (number: number) => `Photo ${String(number)}`,
    loading: 'Loading…',
    productMissing: 'Product not found.',
    retry: 'Retry',
  },
};
type Language = keyof typeof messages;
const cataloguePageSize = 20;
const badgeTones: Record<CatalogueBadgeColor, StatusTone> = {
  ACCENT: 'accent',
  NEUTRAL: 'neutral',
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  DANGER: 'danger',
};
@Injectable({ providedIn: 'root' })
class StorefrontApi {
  private readonly apollo = inject(Apollo);
  shop() {
    return firstValueFrom(
      this.apollo.query({ query: PublicShopDocument, fetchPolicy: 'no-cache' }),
    );
  }
  catalogue(offset: number) {
    return firstValueFrom(
      this.apollo.query({
        query: CatalogueDocument,
        variables: { offset, limit: cataloguePageSize },
        fetchPolicy: 'no-cache',
      }),
    );
  }
  product(id: string) {
    return firstValueFrom(
      this.apollo.query({
        query: CatalogueProductDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      }),
    );
  }
  me() {
    return firstValueFrom(this.apollo.query({ query: ShopperMeDocument, fetchPolicy: 'no-cache' }));
  }
  register(input: { name: string; email: string; password: string }) {
    return firstValueFrom(
      this.apollo.mutate({ mutation: RegisterShopperDocument, variables: input }),
    );
  }
  signIn(input: { email: string; password: string }) {
    return firstValueFrom(
      this.apollo.mutate({ mutation: SignInShopperDocument, variables: input }),
    );
  }
  signOut() {
    return firstValueFrom(this.apollo.mutate({ mutation: SignOutShopperDocument }));
  }
}
@Component({
  selector: 'holita-storefront-page',
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="shop-header">
      <a class="shop-name" [routerLink]="base">{{ shop()?.name ?? 'Holita' }}</a>
      <nav [attr.aria-label]="t().navigation">
        <a [routerLink]="base" [attr.aria-current]="page === 'catalogue' ? 'page' : null">
          {{ t().products }}
        </a>
        <a
          [routerLink]="[...base, 'account']"
          [attr.aria-current]="page === 'account' ? 'page' : null"
        >
          {{ t().account }}
        </a>
        <button class="language" type="button" (click)="toggleLanguage()">
          {{ language() === 'bg' ? 'EN' : 'BG' }}
        </button>
      </nav>
    </header>
    <main>
      @if (missing()) {
        <p class="shop-state" role="alert">{{ t().shopMissing }}</p>
      } @else {
        @if (page === 'catalogue') {
          <div class="catalogue-heading">
            <h1>{{ t().products }}</h1>
            @if (catalogue(); as result) {
              <span>{{ t().count(result.total) }}</span>
            }
          </div>
          @if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          }
          @if (catalogue(); as result) {
            @if (result.items.length) {
              <ul class="catalogue-grid" [attr.aria-busy]="catalogueLoading() || null">
                @for (item of result.items; track item.id) {
                  <li class="catalogue-card">
                    <a
                      class="product-link"
                      [routerLink]="[...base, 'product', item.id]"
                      [attr.aria-labelledby]="'product-' + item.id"
                      [attr.aria-describedby]="
                        'availability-' + item.id + (item.badges.length ? ' badges-' + item.id : '')
                      "
                    >
                      @if (item.coverImage; as cover) {
                        <img
                          class="catalogue-cover"
                          [src]="cover.url"
                          [alt]="cover.altText ?? t().productImageNumber(1)"
                          loading="lazy"
                        />
                      }
                      @if (item.brand; as brand) {
                        <span class="product-brand">
                          @if (brand.logoUrl) {
                            <img
                              [src]="brand.logoUrl"
                              alt=""
                              width="36"
                              height="36"
                              loading="lazy"
                            />
                          }
                          {{ brand.name }}
                        </span>
                      }
                      <h2 [id]="'product-' + item.id">{{ item.name }}</h2>
                      @if (item.badges.length) {
                        <span class="catalogue-badges" [id]="'badges-' + item.id">
                          @for (badge of item.badges; track badge.id) {
                            <p-tag [value]="badge.name" [severity]="badgeSeverity(badge.color)" />
                          }
                        </span>
                      }
                      <span class="catalogue-offer">
                        <span class="catalogue-card-bottom">
                          <span class="app-num">{{ formatPrice(item.price) }}</span>
                          <span class="product-arrow" aria-hidden="true">↗</span>
                        </span>
                        <p-tag
                          class="product-availability"
                          [id]="'availability-' + item.id"
                          [value]="item.available ? t().inStock : t().outOfStock"
                          [severity]="availabilitySeverity(item.available)"
                        />
                      </span>
                    </a>
                  </li>
                }
              </ul>
              @if (result.total > pageSize) {
                <nav class="catalogue-pagination" [attr.aria-label]="t().pagination">
                  <button
                    type="button"
                    [disabled]="catalogueLoading() || offset() === 0"
                    (click)="loadCatalogue(offset() - pageSize)"
                  >
                    {{ t().previous }}
                  </button>
                  <span class="app-num" aria-live="polite">
                    {{ offset() + 1 }}–{{ offset() + result.items.length }} / {{ result.total }}
                  </span>
                  <button
                    type="button"
                    [disabled]="catalogueLoading() || offset() + pageSize >= result.total"
                    (click)="loadCatalogue(offset() + pageSize)"
                  >
                    {{ t().next }}
                  </button>
                </nav>
              }
            } @else {
              <p class="shop-state">{{ t().empty }}</p>
            }
          } @else if ((loading() || catalogueLoading()) && !error()) {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'product') {
          @let item = product();
          <div class="product-navigation">
            @if (item && item.categoryPath.length) {
              <nav class="product-breadcrumbs" [attr.aria-label]="t().productPath">
                <ol role="list">
                  <li>
                    <a class="product-back" [routerLink]="base">{{ t().products }}</a>
                  </li>
                  @for (category of item.categoryPath; track category.id) {
                    <li>
                      <span aria-hidden="true">›</span> <span>{{ category.name }}</span>
                    </li>
                  }
                  <li>
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">{{ item.name }}</span>
                  </li>
                </ol>
              </nav>
            } @else {
              <a class="product-back" [routerLink]="base">
                <span aria-hidden="true">←</span> {{ t().back }}
              </a>
            }
          </div>
          @if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else if (item) {
            @let photo = item.images[photoIndex()];
            <article
              class="product-detail"
              [class.with-brand]="!photo && item.brand?.logoUrl"
              [class.with-gallery]="!!photo"
            >
              @if (photo) {
                <section class="detail-gallery" [attr.aria-label]="t().productGallery">
                  <img
                    class="detail-photo"
                    [src]="photo.url"
                    [alt]="photo.altText ?? t().productImageNumber(photoIndex() + 1)"
                  />
                  @if (item.images.length > 1) {
                    <ul class="detail-thumbnails">
                      @for (image of item.images; track image.url; let index = $index) {
                        <li>
                          <button
                            type="button"
                            [attr.aria-pressed]="photoIndex() === index"
                            [attr.aria-label]="t().productImageNumber(index + 1)"
                            (click)="photoIndex.set(index)"
                          >
                            <img [src]="image.url" alt="" />
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </section>
              }
              <div class="product-summary">
                @if (item.brand; as brand) {
                  <p class="product-brand">
                    @if (photo && brand.logoUrl) {
                      <img [src]="brand.logoUrl" alt="" width="36" height="36" />
                    }
                    {{ brand.name }}
                  </p>
                }
                <h1>{{ item.name }}</h1>
                <div class="product-offer">
                  <p class="app-num product-price">{{ formatPrice(item.price) }}</p>
                  <p-tag
                    class="product-availability"
                    [value]="item.available ? t().inStock : t().outOfStock"
                    [severity]="availabilitySeverity(item.available)"
                  />
                </div>
                @if (description(); as detail) {
                  <p class="product-description" [attr.lang]="detail.language">{{ detail.text }}</p>
                }
                @if (item.tags.length) {
                  <div class="product-tags">
                    <h2 id="product-tags">{{ t().productTags }}</h2>
                    <ul role="list" aria-labelledby="product-tags">
                      @for (tag of item.tags; track tag.id) {
                        <li>{{ tag.name }}</li>
                      }
                    </ul>
                  </div>
                }
              </div>
              @if (!photo && item.brand?.logoUrl; as logo) {
                <div class="product-brand brand-art">
                  <img [src]="logo" alt="" width="144" height="144" />
                </div>
              }
              @if (specifications().length) {
                <section class="product-specifications" aria-labelledby="product-specifications">
                  <h2 id="product-specifications">{{ t().specifications }}</h2>
                  @for (group of specifications(); track $index) {
                    <div>
                      <h3>{{ group.name }}</h3>
                      <dl>
                        @for (specification of group.values; track $index) {
                          <div>
                            <dt>{{ specification.name }}</dt>
                            <dd>{{ specification.value }}</dd>
                          </div>
                        }
                      </dl>
                    </div>
                  }
                </section>
              }
            </article>
          } @else if (loading()) {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          } @else {
            <h1 class="shop-state">{{ t().productMissing }}</h1>
          }
        }
        @if (error() && page !== 'catalogue' && page !== 'product') {
          <p role="alert">{{ t().error }}</p>
        }
        @if (page === 'register' || page === 'sign-in') {
          <h1>{{ page === 'register' ? t().register : t().signIn }}</h1>
          <form [formGroup]="form" (ngSubmit)="submit()">
            @if (page === 'register') {
              <label for="name">{{ t().name }}</label
              ><input id="name" formControlName="name" autocomplete="name" />
            }
            <label for="email">{{ t().email }}</label
            ><input id="email" type="email" formControlName="email" autocomplete="email" />
            <label for="password">{{ t().password }}</label
            ><input
              id="password"
              type="password"
              formControlName="password"
              [attr.autocomplete]="page === 'register' ? 'new-password' : 'current-password'"
            />
            <button type="submit" [disabled]="busy()">
              {{ page === 'register' ? t().register : t().signIn }}
            </button>
          </form>
          <a [routerLink]="[...base, page === 'register' ? 'sign-in' : 'register']">{{
            page === 'register' ? t().signIn : t().register
          }}</a>
        }
        @if (page === 'account') {
          <h1>{{ t().account }}</h1>
          @if (shopper(); as person) {
            <p>{{ person.name }}</p>
            <p>{{ person.email }}</p>
            <button type="button" (click)="signOut()">{{ t().signOut }}</button>
          } @else {
            <a [routerLink]="[...base, 'sign-in']">{{ t().signIn }}</a>
            <a [routerLink]="[...base, 'register']">{{ t().register }}</a>
          }
        }
      }
    </main>
    <ng-template #requestError>
      <div class="shop-state">
        <p role="alert">{{ t().error }}</p>
        <button type="button" (click)="retry()">{{ t().retry }}</button>
      </div>
    </ng-template>
  `,
  styleUrl: './storefront-page.scss',
})
class StorefrontPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StorefrontApi);
  private readonly document = inject(DOCUMENT);
  readonly shopId = this.route.snapshot.paramMap.get('shopId') ?? '';
  readonly base = ['/s', this.shopId];
  readonly page = this.route.snapshot.routeConfig?.path?.split('/').at(2) ?? 'catalogue';
  readonly language = signal<Language>(
    sessionStorage.getItem('holita.storefront.language') === 'en' ? 'en' : 'bg',
  );
  readonly t = () => messages[this.language()];
  readonly shop = signal<{ id: string; name: string } | null>(null);
  readonly missing = signal(false);
  readonly error = signal(false);
  readonly loading = signal(true);
  readonly catalogueLoading = signal(false);
  readonly busy = signal(false);
  readonly catalogue = signal<CatalogueQuery['catalogue'] | null>(null);
  private readonly productDetail = signal<CatalogueProductQuery | null>(null);
  readonly product = computed(() => this.productDetail()?.catalogueProduct ?? null);
  readonly specifications = computed(
    () => this.productDetail()?.catalogueProductSpecifications ?? [],
  );
  readonly photoIndex = signal(0);
  readonly description = computed(() => {
    const item = this.product();
    const bg = item?.descriptionBg;
    const en = item?.descriptionEn;
    if (en && (this.language() === 'en' || !bg)) {
      return { text: en, language: 'en' };
    }
    return bg ? { text: bg, language: 'bg' } : null;
  });
  readonly shopper = signal<ShopperMeQuery['shopperMe']>(null);
  readonly offset = signal(0);
  readonly pageSize = cataloguePageSize;
  private readonly price = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: 'BGN' }),
  );
  private requestedOffset = 0;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [(c) => Validators.required(c), (c) => Validators.email(c)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [(c) => Validators.required(c), Validators.minLength(12)],
    }),
  });
  constructor() {
    inject(Appearance);
    this.document.documentElement.lang = this.language();
    void this.load();
  }
  formatPrice(value: string): string {
    return this.price().format(Number(value));
  }
  protected badgeSeverity(color: CatalogueBadgeColor) {
    return toneSeverity(badgeTones[color]);
  }
  protected availabilitySeverity(available: boolean) {
    return toneSeverity(available ? 'success' : 'neutral');
  }
  toggleLanguage() {
    const language = this.language() === 'bg' ? 'en' : 'bg';
    this.language.set(language);
    this.document.documentElement.lang = language;
    sessionStorage.setItem('holita.storefront.language', language);
  }
  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const shop = await this.api.shop();
      this.shop.set(shop.data?.shop ?? null);
      if (!this.shop()) {
        this.missing.set(true);
        return;
      }
      if (this.page === 'catalogue') {
        await this.loadCatalogue(0);
      }
      if (this.page === 'product') {
        const { data } = await this.api.product(this.route.snapshot.paramMap.get('id') ?? '');
        this.productDetail.set(data ?? null);
      }
      if (this.page === 'account') {
        this.shopper.set((await this.api.me()).data?.shopperMe ?? null);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  retry() {
    if (this.page === 'catalogue' && this.shop()) {
      void this.loadCatalogue(this.requestedOffset);
    } else {
      void this.load();
    }
  }
  async loadCatalogue(offset: number) {
    this.requestedOffset = offset;
    this.catalogueLoading.set(true);
    this.error.set(false);
    try {
      this.catalogue.set((await this.api.catalogue(offset)).data?.catalogue ?? null);
      this.offset.set(offset);
    } catch {
      this.error.set(true);
    } finally {
      this.catalogueLoading.set(false);
    }
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || (this.page === 'register' && !this.form.value.name?.trim())) {
      return;
    }
    this.busy.set(true);
    this.error.set(false);
    try {
      const input = this.form.getRawValue();
      const result =
        this.page === 'register'
          ? (await this.api.register(input)).data?.registerShopper
          : (await this.api.signIn({ email: input.email, password: input.password })).data
              ?.signInShopper;
      if (!result) {
        throw new Error('Missing session');
      }
      sessionStorage.setItem(`holita.shopper.${this.shopId}`, result.token);
      await this.router.navigate([...this.base, 'account']);
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
  async signOut() {
    try {
      await this.api.signOut();
      sessionStorage.removeItem(`holita.shopper.${this.shopId}`);
      this.shopper.set(null);
    } catch {
      this.error.set(true);
    }
  }
}
@Component({
  selector: 'holita-storefront',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class StorefrontApp {}
const pages = [
  { path: 's/:shopId', component: StorefrontPage, data: { page: 'catalogue' } },
  { path: 's/:shopId/product/:id', component: StorefrontPage, data: { page: 'product' } },
  { path: 's/:shopId/register', component: StorefrontPage, data: { page: 'register' } },
  { path: 's/:shopId/sign-in', component: StorefrontPage, data: { page: 'sign-in' } },
  { path: 's/:shopId/account', component: StorefrontPage, data: { page: 'account' } },
];
// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const license = await loadLocalConfig(readPrimeUiLicense, undefined);
  await bootstrapApplication(StorefrontApp, {
    providers: [
      provideHttpClient(),
      provideRouter(pages),
      provideOsnovaTheme(appTheme, license),
      provideApollo(() => {
        const headers = new ApolloLink((operation, forward) => {
          const id = /^\/s\/([^/]+)/.exec(window.location.pathname)?.[1] ?? '';
          const token = sessionStorage.getItem(`holita.shopper.${id}`);
          operation.setContext({
            headers: { 'x-branch-id': id, ...(token ? { authorization: `Bearer ${token}` } : {}) },
          });
          return forward(operation);
        });
        return {
          link: ApolloLink.from([headers, inject(HttpLink).create({ uri: '/graphql' })]),
          cache: new InMemoryCache(),
        };
      }),
    ],
  });
}
void start().catch((error: unknown) => {
  console.error(error);
});
