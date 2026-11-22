import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  provideRouter,
} from '@angular/router';
import { InMemoryCache } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { loadLocalConfig, readPrimeUiLicense } from '@osnova/ui/app';
import { Appearance, appTheme, provideOsnovaTheme } from '@osnova/ui/theme';
import { messages, type Language } from './storefront-messages';
import { StorefrontApi } from './storefront-api';
import { CatalogueBrowse } from './catalogue-browse';
import { browseSections } from './catalogue-url';
import {
  CartState,
  forgetGuestCart,
  guestCartToken,
  maxCartQuantity,
  quantityControl,
  shopperStorageKey,
  type CartWriteError,
} from './cart-state';
import { CartMergeNotice, CartPage } from './cart-page';
import { CheckoutPage } from './checkout-page';
import { OrderConfirmationPage } from './order-confirmation-page';
import { ShopperOrdersPage } from './shopper-orders-page';
import { StorefrontBlog } from './storefront-blog';
import { localizedContent } from './storefront-content';
import type {
  CatalogueProductQuery,
  ShopNavigationLinkFieldsFragment,
} from './generated/operations';

type VariantSelection = NonNullable<CatalogueProductQuery['catalogueProduct']>['variantSelection'];
type ProductVariant = VariantSelection['variants'][number];

function preferredVariant(variants: readonly ProductVariant[]): ProductVariant | null {
  return variants.find((variant) => variant.available) ?? variants[0] ?? null;
}

@Component({
  selector: 'holita-storefront-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    NgTemplateOutlet,
    CatalogueBrowse,
    CartPage,
    CheckoutPage,
    OrderConfirmationPage,
    ShopperOrdersPage,
    StorefrontBlog,
  ],
  providers: [CartState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let header = headerLinks();
    @let footer = footerLinks();
    <header class="shop-header">
      <a class="shop-name" [routerLink]="base()">{{ shop()?.name ?? 'Holita' }}</a>
      <nav class="shop-utilities" [attr.aria-label]="t().navigation">
        <a [routerLink]="base()" [attr.aria-current]="page === 'catalogue' ? 'page' : null">
          {{ t().products }}
        </a>
        @for (section of browseSections; track section) {
          <a
            [routerLink]="[...base(), section]"
            [attr.aria-current]="page === section ? 'true' : null"
          >
            {{ t()[section] }}
          </a>
        }
      </nav>
      <div class="shop-actions">
        @let cartCount = cartState.cart()?.itemCount ?? null;
        <a
          class="shop-cart-link"
          [routerLink]="[...base(), 'cart']"
          [attr.aria-current]="page === 'cart' ? 'page' : null"
          [attr.aria-label]="cartCount === null ? t().cart : t().cartCount(cartCount)"
        >
          <span class="shop-cart-label">{{ t().cart }}</span>
          @if (cartCount !== null) {
            <span class="shop-chip app-num" data-tone="ACCENT" aria-hidden="true">{{
              cartCount
            }}</span>
          }
        </a>
        <a
          [routerLink]="[...base(), 'account']"
          [attr.aria-current]="page === 'account' ? 'page' : page === 'orders' ? 'true' : null"
        >
          {{ t().account }}
        </a>
        <button class="language" type="button" (click)="toggleLanguage()">
          {{ language() === 'bg' ? 'EN' : 'BG' }}
        </button>
      </div>
      @if (header.length) {
        <nav class="shop-header-links" [attr.aria-label]="t().shopHeaderNavigation">
          <ng-container
            [ngTemplateOutlet]="menuLinks"
            [ngTemplateOutletContext]="{ $implicit: header }"
          />
        </nav>
      }
      @if (shopNavigation.status() === 'error') {
        <div class="shop-menu-error">
          <span role="alert">{{ t().shopNavigationUnavailable }}</span>
          <button type="button" (click)="shopNavigation.reload()">{{ t().retry }}</button>
        </div>
      }
    </header>
    <main>
      @if (missing()) {
        <p class="shop-state" role="alert">{{ t().shopMissing }}</p>
      } @else {
        @if (
          cartState.sessionExpired() &&
          page !== 'cart' &&
          page !== 'checkout' &&
          page !== 'orders' &&
          page !== 'sign-in' &&
          page !== 'register'
        ) {
          <div class="shop-state">
            <p role="alert">{{ t().cartSessionExpired }}</p>
            <a class="shop-primary" [routerLink]="[...base(), 'sign-in']">{{ t().signIn }}</a>
          </div>
        }
        @if (browse) {
          @if (shop()) {
            <holita-catalogue-browse
              [language]="language()"
              [shopId]="shopId()"
              [section]="section"
            />
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'pages') {
          <div class="product-navigation">
            <a class="product-back" [routerLink]="base()">
              <span aria-hidden="true">←</span> {{ t().back }}
            </a>
          </div>
          @if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else if (loading()) {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          } @else if (content(); as article) {
            <article class="shop-panel content-article" [attr.lang]="article.language">
              <h1>{{ article.title }}</h1>
              <p>{{ article.body }}</p>
            </article>
          } @else {
            <h1 class="shop-state">{{ t().pageMissing }}</h1>
          }
        }
        @if (page === 'blog') {
          @if (shop()) {
            <holita-storefront-blog [language]="language()" [shopId]="shopId()" [slug]="slug()" />
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
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
                    <a class="product-back" [routerLink]="base()">{{ t().products }}</a>
                  </li>
                  @for (category of item.categoryPath; track category.id) {
                    <li>
                      <span aria-hidden="true">›</span>
                      <a
                        class="product-back"
                        [routerLink]="[...base(), 'categories', category.slug]"
                      >
                        {{ category.name }}
                      </a>
                    </li>
                  }
                  <li class="product-current-crumb">
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">{{ item.name }}</span>
                  </li>
                </ol>
              </nav>
            } @else {
              <a class="product-back" [routerLink]="base()">
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
              } @else if (item.brand?.logoUrl; as logo) {
                <div class="product-brand brand-art">
                  <img [src]="logo" alt="" width="144" height="144" />
                </div>
              }
              <div class="product-summary">
                @if (item.brand; as brand) {
                  <a class="product-brand" [routerLink]="[...base(), 'brands', brand.slug]">
                    @if (photo && brand.logoUrl) {
                      <img [src]="brand.logoUrl" alt="" width="36" height="36" />
                    }
                    {{ brand.name }}
                  </a>
                }
                <h1>{{ item.name }}</h1>
                @if (item.badges.length) {
                  <div class="shop-badge-list">
                    @for (badge of item.badges; track badge.id) {
                      <span class="shop-chip" [attr.data-tone]="badge.color">{{ badge.name }}</span>
                    }
                  </div>
                }
                @if (selectedVariant(); as variant) {
                  @let available = sellableVariantId() !== null;
                  <div class="product-offer" role="status" aria-atomic="true">
                    <p class="app-num product-price">{{ formatPrice(variant.price) }}</p>
                    <span
                      class="shop-chip product-availability"
                      [attr.data-tone]="available ? 'in-stock' : 'out-of-stock'"
                    >
                      {{ available ? t().inStock : t().outOfStock }}
                    </span>
                  </div>
                  @if (variantOptions().length || variantChoices().length) {
                    <div class="product-variants">
                      @for (option of variantOptions(); track option.id; let index = $index) {
                        <fieldset class="variant-group">
                          <legend>{{ option.name }}</legend>
                          <div class="variant-choices">
                            @for (value of option.values; track value.id) {
                              <label class="variant-choice">
                                <input
                                  type="radio"
                                  [name]="option.id"
                                  [value]="value.id"
                                  [checked]="variant.optionValueIds[index] === value.id"
                                  [disabled]="!matchingVariants(index, value.id).length"
                                  (change)="chooseOption(index, value.id)"
                                />
                                <span>{{ value.label }}</span>
                              </label>
                            }
                          </div>
                        </fieldset>
                      } @empty {
                        <fieldset class="variant-group">
                          <legend>{{ t().variant }}</legend>
                          <div class="variant-choices">
                            @for (choice of variantChoices(); track choice.variant.id) {
                              <label class="variant-choice">
                                <input
                                  type="radio"
                                  name="variant"
                                  [value]="choice.variant.id"
                                  [checked]="variant.id === choice.variant.id"
                                  (change)="selectedVariant.set(choice.variant)"
                                />
                                <span>{{ choice.label }}</span>
                              </label>
                            }
                          </div>
                        </fieldset>
                      }
                    </div>
                  }
                  @let quantity = addQuantity();
                  <div class="product-cart">
                    <form class="shop-control-row" (submit)="$event.preventDefault(); addToCart()">
                      <label class="shop-quantity-field" for="product-quantity">
                        {{ t().quantity }}
                        <input
                          id="product-quantity"
                          type="number"
                          min="1"
                          step="1"
                          [max]="maxCartQuantity"
                          [formControl]="quantity"
                          [readOnly]="!available || cartState.locked()"
                          [attr.aria-invalid]="quantity.touched && quantity.invalid ? 'true' : null"
                        />
                      </label>
                      <button
                        class="shop-primary"
                        type="submit"
                        [disabled]="!available || quantity.invalid || cartState.locked()"
                      >
                        {{ t().addToCart }}
                      </button>
                    </form>
                    @let feedback = added();
                    @if (feedback === 'ok') {
                      <p class="product-cart-added" role="status">{{ t().cartAdded }}</p>
                    } @else if (feedback) {
                      <p class="product-cart-error" role="alert">{{ t()[feedback] }}</p>
                    } @else if (quantity.touched && quantity.invalid) {
                      <p class="product-cart-error">{{ t().cartInvalidQuantity }}</p>
                    }
                  </div>
                }
                @if (description(); as detail) {
                  <p class="product-description" [attr.lang]="detail.language">{{ detail.text }}</p>
                }
                @if (item.tags.length) {
                  <div class="product-tags">
                    <h2 id="product-tags">{{ t().productTags }}</h2>
                    <ul role="list" aria-labelledby="product-tags">
                      @for (tag of item.tags; track tag.id) {
                        <li>
                          <a [routerLink]="[...base(), 'tags', tag.slug]">{{ tag.name }}</a>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
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
        @if (page === 'cart') {
          <holita-shop-cart
            [language]="language()"
            [priceFormat]="price()"
            [mergeNotice]="mergeNotice()"
          />
        }
        @if (page === 'checkout') {
          @if (shop()) {
            @if (orderId(); as order) {
              <holita-order-confirmation [language]="language()" [orderId]="order" />
            } @else {
              <holita-checkout [language]="language()" />
            }
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'register' || page === 'sign-in') {
          @let registering = page === 'register';
          <section class="account-view" aria-labelledby="account-title">
            <header class="shop-page-heading">
              <h1 id="account-title">{{ registering ? t().register : t().signIn }}</h1>
            </header>
            <div class="account-panel">
              @if (cartState.sessionExpired()) {
                <p class="account-error" role="alert">{{ t().cartSessionExpired }}</p>
              }
              <form [formGroup]="form" (ngSubmit)="submit()">
                @if (registering) {
                  <label class="account-field" for="name">
                    {{ t().name }}
                    <input id="name" formControlName="name" autocomplete="name" />
                  </label>
                }
                <label class="account-field" for="email">
                  {{ t().email }}
                  <input id="email" type="email" formControlName="email" autocomplete="email" />
                </label>
                <label class="account-field" for="password">
                  {{ t().password }}
                  <input
                    id="password"
                    type="password"
                    formControlName="password"
                    [attr.autocomplete]="registering ? 'new-password' : 'current-password'"
                  />
                </label>
                @if (error()) {
                  <p class="account-error" role="alert">{{ t().error }}</p>
                }
                <button class="shop-primary" type="submit" [disabled]="busy()">
                  {{ registering ? t().register : t().signIn }}
                </button>
              </form>
              <a
                class="shop-text-link"
                [routerLink]="[...base(), registering ? 'sign-in' : 'register']"
              >
                {{ registering ? t().signIn : t().register }}
              </a>
            </div>
          </section>
        }
        @if (page === 'account') {
          <section class="account-view" aria-labelledby="account-title">
            <header class="shop-page-heading">
              <h1 id="account-title">{{ t().account }}</h1>
            </header>
            <div class="account-panel">
              @if (error()) {
                <p class="account-error" role="alert">{{ t().error }}</p>
              }
              @if (loading()) {
                <p role="status">{{ t().loading }}</p>
              } @else if (shopper(); as person) {
                <div class="account-identity">
                  <p>{{ person.name }}</p>
                  <p>{{ person.email }}</p>
                </div>
                <div class="account-actions">
                  <a class="shop-primary" [routerLink]="[...base(), 'account', 'orders']">
                    {{ t().accountOrders }}
                  </a>
                  <button
                    class="shop-secondary"
                    type="button"
                    [disabled]="busy()"
                    (click)="signOut()"
                  >
                    {{ t().signOut }}
                  </button>
                </div>
              } @else {
                <div class="account-actions">
                  <a class="shop-primary" [routerLink]="[...base(), 'sign-in']">{{ t().signIn }}</a>
                  <a class="shop-text-link" [routerLink]="[...base(), 'register']">{{
                    t().register
                  }}</a>
                </div>
              }
            </div>
          </section>
        }
        @if (page === 'orders') {
          @if (shop()) {
            <holita-shopper-orders [language]="language()" [orderId]="orderId()" />
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
      }
    </main>
    @if (footer.length) {
      <footer class="shop-footer">
        <nav [attr.aria-label]="t().shopFooterNavigation">
          <ng-container
            [ngTemplateOutlet]="menuLinks"
            [ngTemplateOutletContext]="{ $implicit: footer }"
          />
        </nav>
      </footer>
    }
    <ng-template #menuLinks let-links>
      @for (link of links; track link.id) {
        @if (link.route) {
          <a
            [routerLink]="link.route"
            routerLinkActive
            [routerLinkActiveOptions]="menuLinkMatch"
            ariaCurrentWhenActive="page"
            [attr.lang]="link.language"
            >{{ link.label }}</a
          >
        } @else {
          <a [href]="link.href" [attr.lang]="link.language">{{ link.label }}</a>
        }
      }
    </ng-template>
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
  private readonly destroy = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly orderId = computed(() => this.params().get('orderId'));
  protected readonly slug = computed(() => this.params().get('slug'));
  protected readonly cartState = inject(CartState);
  readonly shopId = this.cartState.shopId;
  readonly base = computed(() => ['/s', this.shopId()]);
  readonly page = this.route.routeConfig?.data?.['orderHistory']
    ? 'orders'
    : (this.route.routeConfig?.path?.split('/').at(2) ?? 'catalogue');
  readonly section = browseSections.find((item) => item === this.page) ?? null;
  readonly browseSections = browseSections;
  readonly browse = this.page === 'catalogue' || this.section !== null;
  readonly language = signal<Language>(
    sessionStorage.getItem('holita.storefront.language') === 'en' ? 'en' : 'bg',
  );
  readonly t = () => messages[this.language()];
  private readonly request = resource({
    params: () => ({
      shopId: this.shopId(),
      id: this.page === 'product' ? this.params().get('id') : null,
      slug: this.page === 'pages' ? this.slug() : null,
    }),
    loader: async ({ params: { shopId, id, slug }, abortSignal }) => {
      const shop = await this.api.shop(shopId);
      abortSignal.throwIfAborted();
      return {
        shop,
        detail: shop && this.page === 'product' && id ? await this.api.product(shopId, id) : null,
        page: shop && this.page === 'pages' && slug ? await this.api.shopPage(shopId, slug) : null,
        shopper:
          shop && this.page === 'account'
            ? await this.api.me(shopId, sessionStorage.getItem(shopperStorageKey(shopId)))
            : null,
      };
    },
  });
  private readonly view = computed(() =>
    this.request.hasValue() ? this.request.value() : undefined,
  );
  readonly shop = computed(() => this.view()?.shop ?? null);
  protected readonly shopNavigation = resource({
    params: () => this.shop()?.id,
    loader: ({ params: shopId }) => this.api.shopNavigation(shopId),
  });
  private readonly navigation = computed(() =>
    this.shopNavigation.hasValue() ? this.shopNavigation.value() : undefined,
  );
  protected readonly headerLinks = computed(() => this.menuLinks(this.navigation()?.header));
  protected readonly footerLinks = computed(() => this.menuLinks(this.navigation()?.footer));
  protected readonly menuLinkMatch = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  } as const;
  readonly missing = computed(() => this.view()?.shop === null);
  private readonly actionError = signal(false);
  readonly error = computed(() => this.actionError() || this.request.status() === 'error');
  readonly loading = this.request.isLoading;
  readonly busy = signal(false);
  protected readonly content = computed(() => localizedContent(this.view()?.page, this.language()));
  private readonly productDetail = computed(() => this.view()?.detail ?? null);
  readonly product = computed(() => this.productDetail()?.catalogueProduct ?? null);
  readonly specifications = computed(
    () => this.productDetail()?.catalogueProductSpecifications ?? [],
  );
  readonly photoIndex = linkedSignal({ source: () => this.product()?.id, computation: () => 0 });
  private readonly variantSelection = computed(() => this.product()?.variantSelection ?? null);
  protected readonly selectedVariant = linkedSignal(() =>
    preferredVariant(this.variantSelection()?.variants ?? []),
  );
  protected readonly sellableVariantId = computed(() => {
    const variant = this.selectedVariant();
    return variant?.available ? variant.id : null;
  });
  protected readonly maxCartQuantity = maxCartQuantity;
  protected readonly addQuantity = linkedSignal({
    source: this.sellableVariantId,
    computation: () => quantityControl(1),
  });
  protected readonly added = linkedSignal({
    source: this.sellableVariantId,
    computation: (): 'ok' | CartWriteError | null => null,
  });
  private readonly navigationInfo: unknown = this.router.currentNavigation()?.extras.info;
  protected readonly mergeNotice = computed(() => {
    const notice = this.navigationInfo;
    return notice instanceof CartMergeNotice && notice.shopId === this.shopId() ? notice : null;
  });
  protected readonly variantOptions = computed(() => {
    const selection = this.variantSelection();
    if (!selection?.options.length) {
      return [];
    }
    const { options, variants } = selection;
    const combinations = new Set(variants.map(({ optionValueIds }) => optionValueIds.join(',')));
    const complete = variants.every(
      ({ optionValueIds }) => optionValueIds.length === options.length,
    );
    return complete && combinations.size === variants.length ? options : [];
  });
  protected readonly variantChoices = computed(() => {
    const selection = this.variantSelection();
    if (!selection || selection.variants.length < 2 || this.variantOptions().length) {
      return [];
    }
    const labels = new Map(
      selection.options.flatMap(({ values }) =>
        values.map<[string, string]>(({ id, label }) => [id, label]),
      ),
    );
    return selection.variants.map((variant) => ({
      variant,
      label: [...variant.optionValueIds.map((id) => labels.get(id)), variant.sku].join(' · '),
    }));
  });
  readonly description = computed(() => {
    const item = this.product();
    const bg = item?.descriptionBg;
    const en = item?.descriptionEn;
    if (en && (this.language() === 'en' || !bg)) {
      return { text: en, language: 'en' };
    }
    return bg ? { text: bg, language: 'bg' } : null;
  });
  readonly shopper = linkedSignal(() => this.view()?.shopper ?? null);
  protected readonly price = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: 'BGN' }),
  );
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
  }
  private menuLinks(links: readonly ShopNavigationLinkFieldsFragment[] = []) {
    const preferred = this.language();
    return links.map(({ id, href, external, labelBg, labelEn }) => {
      const language = labelEn && (preferred === 'en' || !labelBg) ? 'en' : 'bg';
      return {
        id,
        href,
        route: external ? null : this.router.parseUrl(href),
        label: language === 'en' ? labelEn : labelBg,
        language,
      };
    });
  }
  formatPrice(value: string): string {
    return this.price().format(Number(value));
  }
  protected matchingVariants(optionIndex: number, valueId: string) {
    const preceding = this.selectedVariant()?.optionValueIds.slice(0, optionIndex) ?? [];
    return (this.variantSelection()?.variants ?? []).filter(
      ({ optionValueIds }) =>
        optionValueIds[optionIndex] === valueId &&
        preceding.every((id, index) => optionValueIds[index] === id),
    );
  }
  protected chooseOption(optionIndex: number, valueId: string): void {
    const current = this.selectedVariant();
    if (!current) {
      return;
    }
    const variants = this.matchingVariants(optionIndex, valueId);
    const exact = variants.find(({ optionValueIds }) =>
      optionValueIds.every(
        (id, index) => index === optionIndex || id === current.optionValueIds[index],
      ),
    );
    this.selectedVariant.set(exact ?? preferredVariant(variants));
  }
  toggleLanguage() {
    const language = this.language() === 'bg' ? 'en' : 'bg';
    this.language.set(language);
    this.document.documentElement.lang = language;
    sessionStorage.setItem('holita.storefront.language', language);
  }
  retry() {
    this.actionError.set(false);
    this.request.reload();
  }
  protected async addToCart() {
    const variantId = this.sellableVariantId();
    const control = this.addQuantity();
    const quantity = control.value;
    if (!variantId || control.invalid || quantity === null || this.cartState.locked()) {
      return;
    }
    this.added.set(null);
    const result = await this.cartState.add(variantId, quantity);
    if (this.sellableVariantId() === variantId && result !== 'expired') {
      this.added.set(result);
    }
  }
  async submit() {
    this.form.markAllAsTouched();
    if (
      this.busy() ||
      this.form.invalid ||
      (this.page === 'register' && !this.form.value.name?.trim())
    ) {
      return;
    }
    const shopId = this.shopId();
    const guestToken = guestCartToken(shopId);
    this.busy.set(true);
    this.actionError.set(false);
    try {
      const input = this.form.getRawValue();
      const result =
        this.page === 'register'
          ? await this.api.register(shopId, input, guestToken)
          : await this.api.signIn(
              shopId,
              { email: input.email, password: input.password },
              guestToken,
            );
      sessionStorage.setItem(shopperStorageKey(shopId), result.token);
      forgetGuestCart(shopId, guestToken);
      if (!this.destroy.destroyed && this.shopId() === shopId) {
        const destination = guestToken ? 'cart' : 'account';
        await this.router.navigate([...this.base(), destination], {
          info: guestToken ? new CartMergeNotice(shopId, result.cartMergeIssues) : undefined,
        });
      }
    } catch {
      this.actionError.set(true);
    } finally {
      this.busy.set(false);
    }
  }
  async signOut() {
    if (this.busy()) {
      return;
    }
    const shopId = this.shopId();
    const key = shopperStorageKey(shopId);
    const token = sessionStorage.getItem(key);
    this.busy.set(true);
    this.actionError.set(false);
    try {
      await this.api.signOut(shopId, token);
      if (sessionStorage.getItem(key) === token) {
        sessionStorage.removeItem(key);
      }
      if (!this.destroy.destroyed && this.shopId() === shopId) {
        this.shopper.set(null);
        this.cartState.refreshOwner();
      }
    } catch {
      this.actionError.set(true);
    } finally {
      this.busy.set(false);
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
  { path: 's/:shopId', component: StorefrontPage },
  { path: 's/:shopId/product/:id', component: StorefrontPage },
  { path: 's/:shopId/pages/:slug', component: StorefrontPage },
  { path: 's/:shopId/blog', component: StorefrontPage },
  { path: 's/:shopId/blog/:slug', component: StorefrontPage },
  ...browseSections.flatMap((section) => [
    { path: `s/:shopId/${section}`, component: StorefrontPage },
    { path: `s/:shopId/${section}/:slug`, component: StorefrontPage },
  ]),
  { path: 's/:shopId/register', component: StorefrontPage },
  { path: 's/:shopId/sign-in', component: StorefrontPage },
  {
    path: 's/:shopId/account/orders/:orderId',
    component: StorefrontPage,
    data: { orderHistory: true },
  },
  { path: 's/:shopId/account/orders', component: StorefrontPage, data: { orderHistory: true } },
  { path: 's/:shopId/account', component: StorefrontPage },
  { path: 's/:shopId/cart', component: StorefrontPage },
  { path: 's/:shopId/checkout/confirmation/:orderId', component: StorefrontPage },
  { path: 's/:shopId/checkout', component: StorefrontPage },
];
// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const license = await loadLocalConfig(readPrimeUiLicense, undefined);
  await bootstrapApplication(StorefrontApp, {
    providers: [
      provideHttpClient(),
      provideRouter(pages),
      provideOsnovaTheme(appTheme, license),
      provideApollo(() => ({
        link: inject(HttpLink).create({ uri: '/graphql' }),
        cache: new InMemoryCache(),
      })),
    ],
  });
}
void start().catch((error: unknown) => {
  console.error(error);
});
