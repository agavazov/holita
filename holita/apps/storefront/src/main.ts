import { provideHttpClient } from '@angular/common/http';
import { Component, Injectable, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { Apollo, provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { appTheme, provideOsnovaTheme } from '@osnova/ui/theme';
import {
  CatalogueDocument,
  CatalogueProductDocument,
  PublicShopDocument,
  RegisterShopperDocument,
  ShopperMeDocument,
  SignInShopperDocument,
  SignOutShopperDocument,
  type CatalogueQuery,
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
        }
        @if (page === 'catalogue') {
          <h1>{{ t().products }}</h1>
          @if (catalogue(); as result) {
            @if (!result.items.length) {
              <p>{{ t().empty }}</p>
            }
            <ul>
              @for (item of result.items; track item.id) {
                <li>
                  <a [routerLink]="[...base, 'product', item.id]">{{ item.name }}</a>
                  <span>{{ item.price }}</span>
                </li>
              }
            </ul>
            <nav>
              <button
                type="button"
                [disabled]="offset() === 0"
                (click)="loadCatalogue(offset() - 20)"
              >
                {{ t().previous }}</button
              ><button
                type="button"
                [disabled]="offset() + 20 >= result.total"
                (click)="loadCatalogue(offset() + 20)"
              >
                {{ t().next }}
              </button>
            </nav>
          }
        }
        @if (page === 'product') {
          @if (product(); as item) {
            <h1>{{ item.name }}</h1>
            <p>{{ item.price }}</p>
          }
          <a [routerLink]="base">{{ t().back }}</a>
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
      ul {
        list-style: none;
        padding: 0;
      }
      li {
        display: flex;
        justify-content: space-between;
        padding-block: var(--p-app-space-4);
        border-bottom: 1px solid var(--p-content-border-color);
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
  readonly shopId = this.route.snapshot.paramMap.get('shopId') ?? '';
  readonly base = ['/s', this.shopId];
  readonly page: string = this.route.snapshot.data['page'];
  readonly language = signal<Language>(
    sessionStorage.getItem('holita.storefront.language') === 'en' ? 'en' : 'bg',
  );
  readonly t = () => messages[this.language()];
  readonly shop = signal<{ id: string; name: string } | null>(null);
  readonly missing = signal(false);
  readonly error = signal(false);
  readonly busy = signal(false);
  readonly catalogue = signal<CatalogueQuery['catalogue'] | null>(null);
  readonly product = signal<{ id: string; name: string; price: string } | null>(null);
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
    void this.load();
  }
  toggleLanguage() {
    const language = this.language() === 'bg' ? 'en' : 'bg';
    this.language.set(language);
    sessionStorage.setItem('holita.storefront.language', language);
  }
  async load() {
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
    }
  }
  async loadCatalogue(offset: number) {
    try {
      this.catalogue.set((await this.api.catalogue(offset)).data?.catalogue ?? null);
      this.offset.set(offset);
    } catch {
      this.error.set(true);
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
void bootstrapApplication(StorefrontApp, {
  providers: [
    provideHttpClient(),
    provideRouter(pages),
    provideOsnovaTheme(appTheme),
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
