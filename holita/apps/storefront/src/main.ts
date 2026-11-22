import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { Tag } from 'primeng/tag';
import { loadLocalConfig, readPrimeUiLicense } from '@osnova/ui/app';
import { Appearance, appTheme, provideOsnovaTheme } from '@osnova/ui/theme';
import { messages, type Language } from './storefront-messages';
import { StorefrontApi } from './storefront-api';
import { CatalogueBrowse } from './catalogue-browse';
import { browseSections } from './catalogue-url';
import { availabilitySeverity } from './product-display';
import type { CatalogueProductQuery } from './generated/operations';

type VariantSelection = NonNullable<CatalogueProductQuery['catalogueProduct']>['variantSelection'];
type ProductVariant = VariantSelection['variants'][number];

function preferredVariant(variants: readonly ProductVariant[]): ProductVariant | null {
  return variants.find((variant) => variant.available) ?? variants[0] ?? null;
}

@Component({
  selector: 'holita-storefront-page',
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet, Tag, CatalogueBrowse],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="shop-header">
      <a class="shop-name" [routerLink]="base()">{{ shop()?.name ?? 'Holita' }}</a>
      <nav [attr.aria-label]="t().navigation">
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
        <a
          [routerLink]="[...base(), 'account']"
          [attr.aria-current]="page === 'account' ? 'page' : null"
        >
          {{ t().account }}
        </a>
        <button class="language" type="button" (click)="toggleLanguage()">
          {{ language() === 'bg' ? 'EN' : 'BG' }}
        </button>
      </div>
    </header>
    <main>
      @if (missing()) {
        <p class="shop-state" role="alert">{{ t().shopMissing }}</p>
      } @else {
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
                  <li>
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
                @if (selectedVariant(); as variant) {
                  @let available = sellableVariantId() !== null;
                  <div class="product-offer" role="status" aria-atomic="true">
                    <p class="app-num product-price">{{ formatPrice(variant.price) }}</p>
                    <p-tag
                      class="product-availability"
                      [value]="available ? t().inStock : t().outOfStock"
                      [severity]="availabilitySeverity(available)"
                    />
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
        @if (error() && !browse && page !== 'product') {
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
          <a [routerLink]="[...base(), page === 'register' ? 'sign-in' : 'register']">{{
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
            <a [routerLink]="[...base(), 'sign-in']">{{ t().signIn }}</a>
            <a [routerLink]="[...base(), 'register']">{{ t().register }}</a>
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
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly shopId = computed(() => this.params().get('shopId') ?? '');
  readonly base = computed(() => ['/s', this.shopId()]);
  readonly page = this.route.routeConfig?.path?.split('/').at(2) ?? 'catalogue';
  readonly section = browseSections.find((item) => item === this.page) ?? null;
  readonly browseSections = browseSections;
  readonly browse = this.page === 'catalogue' || this.section !== null;
  readonly language = signal<Language>(
    sessionStorage.getItem('holita.storefront.language') === 'en' ? 'en' : 'bg',
  );
  readonly t = () => messages[this.language()];
  private readonly request = resource({
    params: () => ({ shopId: this.shopId(), id: this.params().get('id') }),
    loader: async ({ params: { shopId, id }, abortSignal }) => {
      const shop = await this.api.shop(shopId);
      abortSignal.throwIfAborted();
      return {
        shop,
        detail: shop && this.page === 'product' && id ? await this.api.product(shopId, id) : null,
        shopper: shop && this.page === 'account' ? await this.api.me(shopId) : null,
      };
    },
  });
  private readonly view = computed(() =>
    this.request.hasValue() ? this.request.value() : undefined,
  );
  readonly shop = computed(() => this.view()?.shop ?? null);
  readonly missing = computed(() => this.view()?.shop === null);
  private readonly actionError = signal(false);
  readonly error = computed(() => this.actionError() || this.request.status() === 'error');
  readonly loading = this.request.isLoading;
  readonly busy = signal(false);
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
  private readonly price = computed(
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
  formatPrice(value: string): string {
    return this.price().format(Number(value));
  }
  protected readonly availabilitySeverity = availabilitySeverity;
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
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || (this.page === 'register' && !this.form.value.name?.trim())) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(false);
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
      sessionStorage.setItem(`holita.shopper.${this.shopId()}`, result.token);
      await this.router.navigate([...this.base(), 'account']);
    } catch {
      this.actionError.set(true);
    } finally {
      this.busy.set(false);
    }
  }
  async signOut() {
    try {
      await this.api.signOut();
      sessionStorage.removeItem(`holita.shopper.${this.shopId()}`);
      this.shopper.set(null);
    } catch {
      this.actionError.set(true);
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
  ...browseSections.flatMap((section) => [
    { path: `s/:shopId/${section}`, component: StorefrontPage },
    { path: `s/:shopId/${section}/:slug`, component: StorefrontPage },
  ]),
  { path: 's/:shopId/register', component: StorefrontPage },
  { path: 's/:shopId/sign-in', component: StorefrontPage },
  { path: 's/:shopId/account', component: StorefrontPage },
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
          const { shopId } = operation.getContext();
          const id =
            typeof shopId === 'string'
              ? shopId
              : (/^\/s\/([^/]+)/.exec(window.location.pathname)?.[1] ?? '');
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
