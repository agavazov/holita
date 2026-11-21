import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { Component, Injectable, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { Apollo, provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
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
  type CatalogueQuery,
  type CatalogueProductQuery,
  type ShopperMeQuery,
} from './generated/operations';

const messages = {
  bg: {
    products: 'Продукти',
    account: 'Моят профил',
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
    loading: 'Зареждане…',
    productMissing: 'Продуктът не е намерен.',
    retry: 'Опитай отново',
  },
  en: {
    products: 'Products',
    account: 'My account',
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
    loading: 'Loading…',
    productMissing: 'Product not found.',
    retry: 'Retry',
  },
};
type Language = keyof typeof messages;
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
        variables: { offset, limit: 20 },
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
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <header>
      <a [routerLink]="base">{{ shop()?.name ?? 'Holita' }}</a>
      <nav>
        <a [routerLink]="base">{{ t().products }}</a
        ><a [routerLink]="[...base, 'account']">{{ t().account }}</a
        ><button type="button" (click)="toggleLanguage()">
          {{ language() === 'bg' ? 'EN' : 'BG' }}
        </button>
      </nav>
    </header>
    <main>
      @if (missing()) {
        <p role="alert">{{ t().shopMissing }}</p>
      } @else {
        @if (error()) {
          <p role="alert">{{ t().error }}</p>
          @if (page === 'catalogue' || page === 'product') {
            <button type="button" (click)="load()">{{ t().retry }}</button>
          }
        }
        @if (page === 'catalogue') {
          <h1>{{ t().products }}</h1>
          @if (catalogue(); as result) {
            @if (!result.items.length) {
              <p>{{ t().empty }}</p>
            }
            <ul class="catalogue-grid" [attr.aria-busy]="catalogueLoading() || null">
              @for (item of result.items; track item.id) {
                <li class="app-card catalogue-card">
                  <a class="app-link product-link" [routerLink]="[...base, 'product', item.id]">{{
                    item.name
                  }}</a>
                  @if (item.brand; as brand) {
                    <span class="product-brand">
                      @if (brand.logoUrl) {
                        <img [src]="brand.logoUrl" alt="" width="24" height="24" loading="lazy" />
                      }
                      {{ brand.name }}
                    </span>
                  }
                  <span class="app-num">{{ item.price }}</span>
                </li>
              }
            </ul>
            @if (result.total > 20) {
              <div class="catalogue-pagination">
                <button
                  type="button"
                  [disabled]="catalogueLoading() || offset() === 0"
                  (click)="loadCatalogue(offset() - 20)"
                >
                  {{ t().previous }}
                </button>
                <button
                  type="button"
                  [disabled]="catalogueLoading() || offset() + 20 >= result.total"
                  (click)="loadCatalogue(offset() + 20)"
                >
                  {{ t().next }}
                </button>
              </div>
            }
          } @else if (loading()) {
            <p role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'product') {
          <a class="app-link product-back" [routerLink]="base">{{ t().back }}</a>
          @if (product(); as item) {
            <article class="app-card product-detail">
              @if (item.brand; as brand) {
                <p class="product-brand">
                  @if (brand.logoUrl) {
                    <img [src]="brand.logoUrl" alt="" width="32" height="32" />
                  }
                  {{ brand.name }}
                </p>
              }
              <h1>{{ item.name }}</h1>
              <p class="app-num product-price">{{ item.price }}</p>
            </article>
          } @else if (loading()) {
            <p role="status">{{ t().loading }}</p>
          } @else if (!error()) {
            <h1>{{ t().productMissing }}</h1>
          }
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
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 72rem;
        margin: auto;
        padding: var(--p-app-space-6);
      }
      header,
      nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--p-app-space-4);
      }
      header {
        border-bottom: 1px solid var(--p-content-border-color);
        padding-bottom: var(--p-app-space-4);
      }
      main {
        padding-block: var(--p-app-space-6);
      }
      .catalogue-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
        gap: var(--p-app-stack-gap);
        list-style: none;
        padding: 0;
        margin-block: var(--p-app-space-4);
      }
      .catalogue-pagination {
        display: flex;
        justify-content: flex-end;
        gap: var(--p-app-space-2);
      }
      .catalogue-card,
      .product-detail {
        display: grid;
        align-content: start;
        gap: var(--p-app-space-3);
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      .product-link {
        font-weight: 700;
      }
      .product-back {
        display: inline-block;
        margin-block-end: var(--p-app-space-4);
      }
      .product-detail {
        max-inline-size: 42rem;
        padding: var(--p-app-space-6);
      }
      .product-detail :is(h1, p) {
        margin: 0;
      }
      .product-brand {
        display: flex;
        align-items: center;
        gap: var(--p-app-space-2);
        color: var(--p-text-muted-color);
      }
      .product-brand img {
        flex: none;
        border-radius: var(--p-app-radius-control);
        object-fit: contain;
      }
      .product-price {
        font-size: var(--p-app-text-lg);
        font-weight: 700;
      }
      form {
        display: grid;
        gap: var(--p-app-space-2);
        max-width: 28rem;
        margin-block: var(--p-app-space-4);
      }
      input,
      button {
        font: inherit;
        padding: var(--p-app-space-2);
      }
      button {
        cursor: pointer;
      }
    `,
  ],
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
  readonly product = signal<CatalogueProductQuery['catalogueProduct']>(null);
  readonly shopper = signal<ShopperMeQuery['shopperMe']>(null);
  readonly offset = signal(0);
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
        this.product.set(
          (await this.api.product(this.route.snapshot.paramMap.get('id') ?? '')).data
            ?.catalogueProduct ?? null,
        );
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
  async loadCatalogue(offset: number) {
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
