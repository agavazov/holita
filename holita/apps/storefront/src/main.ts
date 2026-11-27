import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChildren,
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
  type Routes,
  provideRouter,
  withInMemoryScrolling,
} from '@angular/router';
import { InMemoryCache } from '@apollo/client/core';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { loadLocalConfig, readPrimeUiLicense } from '@osnova/ui/app';
import { Appearance, appTheme, provideOsnovaTheme } from '@osnova/ui/theme';
import { messages, type Language } from './storefront-messages';
import { shopCurrency } from './storefront-money';
import { StorefrontApi } from './storefront-api';
import { CatalogueBrowse } from './catalogue-browse';
import { browseSections } from './catalogue-url';
import {
  CartState,
  forgetGuestCart,
  guestCartToken,
  maxCartQuantity,
  quantityControl,
  setShopperSession,
  shopperStorageKey,
  type CartWriteError,
} from './cart-state';
import { CartMergeNotice, CartPage } from './cart-page';
import { CartPreview } from './cart-preview';
import { CheckoutPage } from './checkout-page';
import { OrderConfirmationPage } from './order-confirmation-page';
import { ShopperOrdersPage } from './shopper-orders-page';
import { StorefrontBlog } from './storefront-blog';
import { localizedContent, localizedText } from './storefront-content';
import type {
  CatalogueProductQuery,
  ShopNavigationLinkFieldsFragment,
} from './generated/operations';

type VariantSelection = NonNullable<CatalogueProductQuery['catalogueProduct']>['variantSelection'];
type ProductVariant = VariantSelection['variants'][number];
const defaultFavicon = '/storefront-basic/images/favicon.svg';

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
    CartPreview,
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
    @let footerContacts = page !== 'contacts' && hasContactDetails();
    <header class="shop-header" data-header-theme="dark" [hidden]="notFound && !shop()">
      @if (announcement(); as announcement) {
        <div class="shop-announcement">
          <p class="shop-width" [attr.lang]="announcement.language">{{ announcement.text }}</p>
        </div>
      }
      <div class="shop-header-inner shop-width">
        <div class="shop-mobile-actions">
          <button
            type="button"
            class="shop-icon-button"
            [attr.aria-label]="t().openMenu"
            aria-haspopup="dialog"
            aria-controls="mobile-menu"
            (click)="mobileMenu.showModal()"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" stroke-linecap="round" />
            </svg>
          </button>
          <ng-container [ngTemplateOutlet]="searchButton" />
        </div>
        @let shopName = brandingShop()?.displayName ?? 'Holita';
        <a class="shop-name" [routerLink]="base()">
          @if (shopLogo(); as logo) {
            <img [src]="logo" [alt]="shopName" (error)="failedLogo.set(logo)" />
          } @else {
            {{ shopName }}
          }
        </a>
        <div class="shop-desktop-navigation">
          <nav class="shop-utilities" [attr.aria-label]="t().navigation">
            <ng-container [ngTemplateOutlet]="storeLinks" />
          </nav>
          @if (header.length) {
            <nav class="shop-header-links" [attr.aria-label]="t().shopHeaderNavigation">
              <ng-container
                [ngTemplateOutlet]="menuLinks"
                [ngTemplateOutletContext]="{ $implicit: header }"
              />
            </nav>
          }
        </div>
        <div class="shop-actions">
          <span class="shop-desktop-search"
            ><ng-container [ngTemplateOutlet]="searchButton"
          /></span>
          <a
            class="shop-icon-button"
            [routerLink]="[...base(), 'account']"
            [attr.aria-label]="t().account"
            [attr.aria-current]="page === 'account' ? 'page' : page === 'orders' ? 'true' : null"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0 18.7 18.7 0 0 1-15 0Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
          @let cartCount = cartState.cart()?.itemCount ?? null;
          <button
            #cartButton
            type="button"
            class="shop-icon-button shop-cart-link"
            [attr.aria-label]="cartCount === null ? t().cart : t().cartCount(cartCount)"
            aria-haspopup="dialog"
            aria-controls="cart-preview"
            (click)="cartState.refresh(); cartPreview.open(cartButton)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.6-2.9 1.2 12.7a.75.75 0 0 1-.75.82H3.7a.75.75 0 0 1-.75-.82L4.15 7.6a.75.75 0 0 1 .75-.68h14.2a.75.75 0 0 1 .75.68Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="app-num" aria-hidden="true">{{ cartCount ?? 0 }}</span>
          </button>
          <button class="language" type="button" (click)="toggleLanguage()">
            {{ language() === 'bg' ? 'EN' : 'BG' }}
          </button>
        </div>
      </div>
      @if (shopNavigation.status() === 'error') {
        <div class="shop-menu-error shop-width">
          <span role="alert">{{ t().shopNavigationUnavailable }}</span>
          <button type="button" (click)="shopNavigation.reload()">{{ t().retry }}</button>
        </div>
      }
    </header>

    <holita-cart-preview #cartPreview [language]="language()" [priceFormat]="price()" />

    <dialog
      #mobileMenu
      id="mobile-menu"
      class="shop-dialog shop-mobile-menu"
      [attr.aria-label]="t().navigation"
      closedby="any"
    >
      <ng-container
        [ngTemplateOutlet]="closeButton"
        [ngTemplateOutletContext]="{ $implicit: mobileMenu }"
      />
      <nav [attr.aria-label]="t().navigation">
        <ng-container
          [ngTemplateOutlet]="storeLinks"
          [ngTemplateOutletContext]="{ close: mobileMenu }"
        />
      </nav>
      @if (header.length) {
        <nav [attr.aria-label]="t().shopHeaderNavigation">
          <ng-container
            [ngTemplateOutlet]="menuLinks"
            [ngTemplateOutletContext]="{ $implicit: header, close: mobileMenu }"
          />
        </nav>
      }
    </dialog>

    <dialog
      #shopSearch
      id="shop-search"
      class="shop-dialog shop-search-dialog"
      aria-labelledby="shop-search-title"
      closedby="any"
      (close)="searchOpen.set(false)"
    >
      <div class="shop-search-heading">
        <h2 id="shop-search-title">{{ t().search }}</h2>
        <ng-container
          [ngTemplateOutlet]="closeButton"
          [ngTemplateOutletContext]="{ $implicit: shopSearch }"
        />
      </div>
      <form (submit)="$event.preventDefault(); search(shopSearch)">
        <label class="shop-form-field" for="shop-search-input">
          {{ t().searchProducts }}
          <input
            #searchInput
            id="shop-search-input"
            type="search"
            maxlength="200"
            autocomplete="off"
            enterkeyhint="search"
            [value]="searchTerm()"
            (input)="searchTerm.set(searchInput.value)"
            (keydown.arrowdown)="moveSuggestionFocus($event, searchInput, 1)"
            (keydown.arrowup)="moveSuggestionFocus($event, searchInput, -1)"
          />
        </label>
        <button class="shop-primary" type="submit">{{ t().search }}</button>
      </form>
      @let suggestionItems = suggestedProducts();
      <div class="shop-search-status" role="status">
        @if (suggestions.isLoading()) {
          {{ t().searchSuggestionsLoading }}
        } @else if (suggestions.status() === 'error') {
          {{ t().searchSuggestionsFailed }}
        } @else if (suggestionItems && !suggestionItems.length) {
          {{ t().searchSuggestionsEmpty }}
        }
      </div>
      @if (suggestions.status() === 'error') {
        <button class="shop-secondary" type="button" (click)="retrySuggestions(searchInput)">
          {{ t().retry }}
        </button>
      }
      @if (suggestionItems?.length) {
        <ul class="shop-search-results" role="list" [attr.aria-label]="t().searchSuggestions">
          @for (product of suggestionItems; track product.id) {
            <li>
              <a
                #suggestionLink
                [routerLink]="[...base(), 'product', product.id]"
                (click)="shopSearch.close()"
                (keydown.arrowdown)="moveSuggestionFocus($event, searchInput, 1)"
                (keydown.arrowup)="moveSuggestionFocus($event, searchInput, -1)"
              >
                {{ product.name }}
              </a>
            </li>
          }
        </ul>
      }
    </dialog>

    <ng-template #searchButton>
      <button
        type="button"
        class="shop-icon-button"
        [attr.aria-label]="t().search"
        aria-haspopup="dialog"
        aria-controls="shop-search"
        (click)="openSearch(shopSearch, searchInput)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="m21 21-4.9-4.9m2.4-5.6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" stroke-linecap="round" />
        </svg>
      </button>
    </ng-template>

    <ng-template #closeButton let-dialog>
      <button
        class="shop-icon-button"
        type="button"
        [attr.aria-label]="t().close"
        (click)="dialog.close()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
        </svg>
      </button>
    </ng-template>

    <ng-template #storeLinks let-close="close">
      <a
        [routerLink]="[...base(), 'products']"
        [attr.aria-current]="page === 'products' ? 'page' : null"
        (click)="close?.close()"
        >{{ t().products }}</a
      >
      @for (section of browseSections; track section) {
        <a
          [routerLink]="[...base(), section]"
          [attr.aria-current]="page === section ? 'true' : null"
          (click)="close?.close()"
          >{{ t()[section] }}</a
        >
      }
      <a
        [routerLink]="[...base(), 'contacts']"
        [attr.aria-current]="page === 'contacts' ? 'page' : null"
        (click)="close?.close()"
        >{{ t().contacts }}</a
      >
    </ng-template>

    <main [class.shop-width]="!browse || !shop()" [class.shop-main-contained]="!browse || !shop()">
      @if (missing()) {
        <p class="shop-state" role="alert">{{ t().shopMissing }}</p>
      } @else if (notFound) {
        @if (shop()) {
          <header class="shop-page-heading shop-page-heading--with-link">
            <h1>{{ t().pageMissing }}</h1>
            <a class="shop-primary" [routerLink]="base()">{{ t().backToShop }}</a>
          </header>
        } @else if (error()) {
          <ng-container [ngTemplateOutlet]="requestError" />
        } @else {
          <p class="shop-state" role="status">{{ t().loading }}</p>
        }
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
          @if (shop(); as currentShop) {
            <holita-catalogue-browse
              [language]="language()"
              [shopId]="shopId()"
              [shopName]="currentShop.displayName"
              [section]="section"
              [landing]="page === 'catalogue'"
            />
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'contacts') {
          @if (shop()) {
            <div class="product-navigation">
              <nav class="product-breadcrumbs" [attr.aria-label]="t().browsePath">
                <ol role="list">
                  <li>
                    <a class="product-back" [routerLink]="base()">{{ t().home }}</a>
                  </li>
                  <li>
                    <span aria-hidden="true">›</span
                    ><span aria-current="page">{{ t().contacts }}</span>
                  </li>
                </ol>
              </nav>
            </div>
            <section class="shop-contact-view" aria-labelledby="contact-heading">
              <header>
                <h1 id="contact-heading">{{ t().contacts }}</h1>
              </header>
              <div class="shop-contact-panel">
                @if (hasContactDetails()) {
                  <ng-container [ngTemplateOutlet]="contactDetails" />
                } @else {
                  <p>{{ t().noContactDetails }}</p>
                }
              </div>
            </section>
          } @else if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          }
        }
        @if (page === 'pages') {
          <div class="product-navigation">
            <a class="product-back" [routerLink]="[...base(), 'products']">
              <span aria-hidden="true">←</span> {{ t().back }}
            </a>
          </div>
          @if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else if (loading()) {
            <p class="shop-state" role="status">{{ t().loading }}</p>
          } @else if (content(); as article) {
            <article class="content-article" [attr.lang]="article.language">
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
                    <a class="product-back" [routerLink]="[...base(), 'products']">{{
                      t().products
                    }}</a>
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
              <a class="product-back" [routerLink]="[...base(), 'products']">
                <span aria-hidden="true">←</span> {{ t().back }}
              </a>
            }
          </div>
          @if (error()) {
            <ng-container [ngTemplateOutlet]="requestError" />
          } @else if (item) {
            @let photo = item.images[photoIndex()];
            <article class="product-detail">
              @if (photo) {
                <section class="detail-gallery" [attr.aria-label]="t().productGallery">
                  <img
                    class="detail-photo"
                    [src]="photo.url"
                    [alt]="photo.altText ?? t().productImageNumber(photoIndex() + 1)"
                  />
                  @if (item.images.length > 1) {
                    <ul class="detail-thumbnails">
                      @for (image of item.images; track image.id; let index = $index) {
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
              } @else {
                <div class="detail-photo detail-photo-placeholder">{{ t().noPhoto }}</div>
              }
              <div class="product-summary">
                @if (item.badges.length) {
                  <div class="shop-badge-list">
                    @for (badge of item.badges; track badge.id) {
                      <span class="shop-chip" [attr.data-tone]="badge.color">{{ badge.name }}</span>
                    }
                  </div>
                }
                <h1>{{ item.name }}</h1>
                @if (selectedVariant(); as variant) {
                  @let available = sellableVariantId() !== null;
                  <div class="product-offer" role="status" aria-atomic="true">
                    <p class="app-num product-price">{{ formatPrice(variant.price) }}</p>
                    <p class="product-availability" [class.available]="available">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                      >
                        @if (available) {
                          <path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round" />
                        } @else {
                          <path d="M5 10h10" stroke-linecap="round" />
                        }
                      </svg>
                      {{ available ? t().inStock : t().outOfStock }}
                    </p>
                  </div>
                  @if (variantOptions().length || variantChoices().length) {
                    <div class="product-variants">
                      @for (option of variantOptions(); track option.id; let index = $index) {
                        <fieldset class="variant-group">
                          <legend>{{ option.name }}</legend>
                          <div class="variant-choices">
                            @for (value of option.values; track value.id) {
                              @let choice = variantForChoice(index, value.id);
                              <label
                                class="variant-choice"
                                [class.unavailable]="!choice?.available"
                              >
                                <input
                                  type="radio"
                                  [name]="option.id"
                                  [value]="value.id"
                                  [checked]="variant.optionValueIds[index] === value.id"
                                  [disabled]="choice === null"
                                  [attr.aria-describedby]="
                                    !choice?.available ? 'variant-stock-' + value.id : null
                                  "
                                  (change)="choice && selectedVariant.set(choice)"
                                />
                                <ng-container
                                  [ngTemplateOutlet]="variantValue"
                                  [ngTemplateOutletContext]="{ $implicit: value }"
                                />
                                @if (!choice?.available) {
                                  <span [id]="'variant-stock-' + value.id" hidden>{{
                                    t().outOfStock
                                  }}</span>
                                }
                              </label>
                            }
                          </div>
                        </fieldset>
                      } @empty {
                        <fieldset class="variant-group">
                          <legend>{{ t().variant }}</legend>
                          <div class="variant-choices">
                            @for (choice of variantChoices(); track choice.variant.id) {
                              <label
                                class="variant-choice"
                                [class.unavailable]="!choice.variant.available"
                              >
                                <input
                                  type="radio"
                                  name="variant"
                                  [value]="choice.variant.id"
                                  [checked]="variant.id === choice.variant.id"
                                  [attr.aria-describedby]="
                                    !choice.variant.available
                                      ? 'variant-stock-' + choice.variant.id
                                      : null
                                  "
                                  (change)="selectedVariant.set(choice.variant)"
                                />
                                <span class="variant-choice-label variant-choice-combination">
                                  @for (value of choice.values; track value.id) {
                                    <ng-container
                                      [ngTemplateOutlet]="variantValue"
                                      [ngTemplateOutletContext]="{ $implicit: value }"
                                    />
                                    <span aria-hidden="true">·</span>
                                  }
                                  <span class="variant-choice-text">{{ choice.variant.sku }}</span>
                                </span>
                                @if (!choice.variant.available) {
                                  <span [id]="'variant-stock-' + choice.variant.id" hidden>{{
                                    t().outOfStock
                                  }}</span>
                                }
                              </label>
                            }
                          </div>
                        </fieldset>
                      }
                    </div>
                  }
                  <ng-template #variantValue let-value>
                    <span class="variant-choice-label">
                      @if (value.swatchColor; as color) {
                        <span
                          class="shop-option-swatch"
                          aria-hidden="true"
                          [style.background-color]="color"
                        ></span>
                      }
                      <span class="variant-choice-text">{{ value.label }}</span>
                    </span>
                  </ng-template>
                  @let quantity = addQuantity();
                  <div class="product-cart">
                    <form
                      class="shop-control-row"
                      (submit)="$event.preventDefault(); addToCart(cartPreview, addButton)"
                    >
                      <label class="shop-quantity-field" for="product-quantity">
                        {{ t().quantity }}
                        <input
                          id="product-quantity"
                          type="number"
                          [min]="variant.minimumQuantity"
                          step="1"
                          [max]="maxCartQuantity"
                          [formControl]="quantity"
                          [readOnly]="!available || cartState.locked()"
                          [attr.aria-invalid]="quantity.touched && quantity.invalid ? 'true' : null"
                          [attr.aria-describedby]="
                            variant.minimumQuantity > 1 ? 'product-minimum-quantity' : null
                          "
                        />
                      </label>
                      <button
                        #addButton
                        class="shop-primary"
                        type="submit"
                        [disabled]="!available || quantity.invalid || cartState.locked()"
                      >
                        {{ t().addToCart }}
                      </button>
                    </form>
                    @if (variant.minimumQuantity > 1) {
                      <p class="product-minimum-quantity" id="product-minimum-quantity">
                        {{ t().minimumQuantity(variant.minimumQuantity) }}
                      </p>
                    }
                    @let feedback = added();
                    @if (feedback === 'ok') {
                      <p class="product-cart-added" role="status">{{ t().cartAdded }}</p>
                    } @else if (feedback) {
                      <p class="product-cart-error" role="alert">{{ t()[feedback] }}</p>
                    } @else if (quantity.touched && quantity.invalid) {
                      <p class="product-cart-error" role="alert">
                        @if (variant.minimumQuantity > 1 && quantity.hasError('min')) {
                          {{ t().cartMinimumNotMet }}
                        } @else {
                          {{ t().cartInvalidQuantity }}
                        }
                      </p>
                    }
                  </div>
                }
                <div class="product-facts">
                  @if (description(); as detail) {
                    <details open>
                      <summary>{{ t().productDescription }}</summary>
                      <p class="product-description" [attr.lang]="detail.language">
                        {{ detail.text }}
                      </p>
                    </details>
                  }
                  @if (specifications().length) {
                    <details class="product-specifications" [open]="!description()">
                      <summary id="product-specifications">{{ t().specifications }}</summary>
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
                    </details>
                  }
                  @if (item.brand; as brand) {
                    <div class="product-related">
                      <a class="product-brand" [routerLink]="[...base(), 'brands', brand.slug]">
                        @if (brand.logoUrl) {
                          <img [src]="brand.logoUrl" alt="" width="36" height="36" />
                        }
                        {{ brand.name }}
                      </a>
                    </div>
                  }
                  @if (item.tags.length) {
                    <div class="product-tags product-related">
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
              </div>
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
                  <label class="shop-form-field" for="name">
                    {{ t().name }}
                    <input id="name" formControlName="name" autocomplete="name" />
                  </label>
                }
                <label class="shop-form-field" for="email">
                  {{ t().email }}
                  <input id="email" type="email" formControlName="email" autocomplete="email" />
                </label>
                <label class="shop-form-field" for="password">
                  {{ t().password }}
                  <input
                    id="password"
                    type="password"
                    formControlName="password"
                    [attr.autocomplete]="registering ? 'new-password' : 'current-password'"
                  />
                </label>
                @if (error()) {
                  <p class="account-error" role="alert">{{ t()[actionError() ?? 'error'] }}</p>
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
          <section class="account-overview" aria-labelledby="account-title">
            <header class="shop-page-heading">
              <nav class="product-breadcrumbs" [attr.aria-label]="t().browsePath">
                <ol role="list">
                  <li>
                    <a class="product-back" [routerLink]="base()">{{ t().home }}</a>
                  </li>
                  <li>
                    <span aria-hidden="true">›</span
                    ><span aria-current="page">{{ t().account }}</span>
                  </li>
                </ol>
              </nav>
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
    @if (shop(); as storefront) {
      <footer class="shop-footer">
        <div class="shop-footer-inner shop-width">
          <div class="shop-footer-columns">
            <section>
              <h2>{{ t().store }}</h2>
              <ul role="list">
                <li>
                  <a [routerLink]="[...base(), 'products']">{{ t().viewAllProducts }}</a>
                </li>
                @for (section of browseSections; track section) {
                  <li>
                    <a [routerLink]="[...base(), section]">{{ t()[section] }}</a>
                  </li>
                }
              </ul>
            </section>
            @if (footer.length) {
              <section>
                <h2>{{ t().information }}</h2>
                <nav [attr.aria-label]="t().shopFooterNavigation">
                  <ng-container
                    [ngTemplateOutlet]="menuLinks"
                    [ngTemplateOutletContext]="{ $implicit: footer }"
                  />
                </nav>
              </section>
            }
            <section>
              <h2>{{ t().help }}</h2>
              <ul role="list">
                <li>
                  <a [routerLink]="[...base(), 'contacts']">{{ t().contactDetails }}</a>
                </li>
              </ul>
            </section>
            @if (footerContacts) {
              <section>
                <h2>{{ storefront.displayName }}</h2>
                <ng-container [ngTemplateOutlet]="contactDetails" />
              </section>
            }
          </div>
          <div class="shop-footer-bottom">
            <p>{{ storefront.displayName }}</p>
            <label class="shop-footer-language" for="footer-language">
              <span class="shop-visually-hidden">{{ t().language }}</span>
              <select
                #footerLanguage
                id="footer-language"
                [value]="language()"
                (change)="setLanguage(footerLanguage.value === 'en' ? 'en' : 'bg')"
              >
                <option value="bg" lang="bg">Български</option>
                <option value="en" lang="en">English</option>
              </select>
            </label>
          </div>
        </div>
      </footer>
    }
    <ng-template #contactDetails>
      @if (shop(); as details) {
        <dl class="shop-contact-details">
          @if (details.contactEmail; as email) {
            <div>
              <dt>{{ t().email }}</dt>
              <dd>
                <a [href]="emailHref()">{{ email }}</a>
              </dd>
            </div>
          }
          @if (details.contactPhone; as phone) {
            <div>
              <dt>{{ t().phone }}</dt>
              <dd>
                @if (phoneHref(); as href) {
                  <a [href]="href">{{ phone }}</a>
                } @else {
                  {{ phone }}
                }
              </dd>
            </div>
          }
          @if (details.contactAddress; as address) {
            <div>
              <dt>{{ t().contactAddress }}</dt>
              <dd class="shop-contact-address">{{ address }}</dd>
            </div>
          }
        </dl>
      }
    </ng-template>
    <ng-template #menuLinks let-links let-close="close">
      @for (link of links; track link.id) {
        @if (link.route) {
          <a
            [routerLink]="link.route"
            routerLinkActive
            [routerLinkActiveOptions]="menuLinkMatch"
            ariaCurrentWhenActive="page"
            [attr.lang]="link.language"
            (click)="close?.close()"
            >{{ link.label }}</a
          >
        } @else {
          <a [href]="link.href" [attr.lang]="link.language" (click)="close?.close()">{{
            link.label
          }}</a>
        }
      }
    </ng-template>
    <ng-template #requestError>
      <div class="shop-state">
        <p role="alert">{{ t().error }}</p>
        <button class="shop-secondary" type="button" (click)="retry()">{{ t().retry }}</button>
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
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly searchTerm = linkedSignal(() => this.query().get('q') ?? '');
  protected readonly searchOpen = signal(false);
  private readonly suggestionLinks = viewChildren<ElementRef<HTMLAnchorElement>>('suggestionLink');
  protected readonly orderId = computed(() => this.params().get('orderId'));
  protected readonly slug = computed(() => this.params().get('slug'));
  protected readonly cartState = inject(CartState);
  readonly shopId = this.cartState.shopId;
  readonly base = computed(() => ['/s', this.shopId()]);
  protected readonly suggestions = resource({
    params: () => {
      if (!this.searchOpen()) {
        return undefined;
      }
      const search = this.searchTerm().trim();
      const length = Array.from(search).length;
      return length >= 2 && length <= 200 && !search.includes('\u0000')
        ? { shopId: this.shopId(), search }
        : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      abortSignal.throwIfAborted();
      return this.api.suggestions(params.shopId, params.search);
    },
  });
  protected readonly suggestedProducts = computed(() =>
    this.suggestions.hasValue() ? this.suggestions.value() : undefined,
  );
  readonly page = this.route.routeConfig?.data?.['orderHistory']
    ? 'orders'
    : (this.route.routeConfig?.path?.split('/').at(2) ?? 'catalogue');
  protected readonly notFound = this.route.routeConfig?.data?.['notFound'] === true;
  readonly section = browseSections.find((item) => item === this.page) ?? null;
  readonly browseSections = browseSections;
  readonly browse = this.page === 'catalogue' || this.page === 'products' || this.section !== null;
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
  protected readonly brandingShop = computed(() => {
    const shop = this.shop();
    return shop?.id === this.shopId().toLowerCase() ? shop : null;
  });
  protected readonly failedLogo = signal<string | null>(null);
  protected readonly shopLogo = computed(() => {
    const url = this.brandingShop()?.logoUrl;
    return url && url !== this.failedLogo() ? url : null;
  });
  protected readonly announcement = computed(() => {
    const shop = this.shop();
    return localizedText(this.language(), shop?.announcementBg, shop?.announcementEn);
  });
  protected readonly hasContactDetails = computed(() => {
    const shop = this.shop();
    return !!(shop?.contactEmail || shop?.contactPhone || shop?.contactAddress);
  });
  protected readonly emailHref = computed(() => {
    const email = this.shop()?.contactEmail;
    if (!email) {
      return null;
    }
    const at = email.lastIndexOf('@');
    return `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`;
  });
  protected readonly phoneHref = computed(() => {
    const dial = this.shop()?.contactPhone?.replace(/[\p{Zs}().-]/gu, '');
    return dial && /^\+?\d{3,15}$/u.test(dial) ? `tel:${dial}` : null;
  });
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
  protected readonly actionError = signal<'error' | 'signInThrottled' | null>(null);
  readonly error = computed(() => this.actionError() !== null || this.request.status() === 'error');
  readonly loading = this.request.isLoading;
  readonly busy = signal(false);
  protected readonly content = computed(() => localizedContent(this.view()?.page, this.language()));
  private readonly productDetail = computed(() => this.view()?.detail ?? null);
  readonly product = computed(() => this.productDetail()?.catalogueProduct ?? null);
  readonly specifications = computed(
    () => this.productDetail()?.catalogueProductSpecifications ?? [],
  );
  private readonly variantSelection = computed(() => this.product()?.variantSelection ?? null);
  protected readonly selectedVariant = linkedSignal(() =>
    preferredVariant(this.variantSelection()?.variants ?? []),
  );
  protected readonly photoIndex = linkedSignal(() => {
    const imageId = this.selectedVariant()?.imageId;
    return Math.max(0, this.product()?.images.findIndex((image) => image.id === imageId) ?? -1);
  });
  protected readonly sellableVariantId = computed(() => {
    const variant = this.selectedVariant();
    return variant?.available ? variant.id : null;
  });
  protected readonly maxCartQuantity = maxCartQuantity;
  protected readonly addQuantity = linkedSignal(() => {
    const minimum = this.selectedVariant()?.minimumQuantity ?? 1;
    return quantityControl(minimum, minimum);
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
    const values = new Map(
      selection.options.flatMap((option) =>
        option.values.map((value) => [value.id, value] as const),
      ),
    );
    return selection.variants.map((variant) => ({
      variant,
      values: variant.optionValueIds.flatMap((id) => values.get(id) ?? []),
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
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: shopCurrency }),
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
    effect((onCleanup) => {
      const favicon = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const url = this.brandingShop()?.faviconUrl;
      if (!favicon || !url) {
        return;
      }
      const restore = () => {
        favicon.setAttribute('href', defaultFavicon);
      };
      favicon.addEventListener('error', restore, { once: true });
      favicon.href = url;
      onCleanup(() => {
        favicon.removeEventListener('error', restore);
        restore();
      });
    });
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
  protected variantForChoice(optionIndex: number, valueId: string) {
    const current = this.selectedVariant();
    if (!current) {
      return null;
    }
    const preceding = current.optionValueIds.slice(0, optionIndex);
    const variants = (this.variantSelection()?.variants ?? []).filter(
      ({ optionValueIds }) =>
        optionValueIds[optionIndex] === valueId &&
        preceding.every((id, index) => optionValueIds[index] === id),
    );
    const exact = variants.find(({ optionValueIds }) =>
      optionValueIds.every(
        (id, index) => index === optionIndex || id === current.optionValueIds[index],
      ),
    );
    return exact ?? preferredVariant(variants);
  }
  toggleLanguage() {
    this.setLanguage(this.language() === 'bg' ? 'en' : 'bg');
  }
  protected setLanguage(language: Language) {
    this.language.set(language);
    this.document.documentElement.lang = language;
    sessionStorage.setItem('holita.storefront.language', language);
  }
  protected openSearch(dialog: HTMLDialogElement, input: HTMLInputElement) {
    dialog.showModal();
    this.searchOpen.set(true);
    input.focus();
    input.select();
  }
  protected moveSuggestionFocus(event: Event, input: HTMLInputElement, step: 1 | -1) {
    const links = this.suggestionLinks();
    if (!links.length) {
      return;
    }
    event.preventDefault();
    const index = links.findIndex(({ nativeElement }) => nativeElement === event.currentTarget);
    const first = step === 1 ? 0 : links.length - 1;
    const next = index === -1 ? first : index + step;
    (links[next]?.nativeElement ?? input).focus();
  }
  protected retrySuggestions(input: HTMLInputElement) {
    input.focus();
    this.suggestions.reload();
  }
  protected search(dialog: HTMLDialogElement) {
    dialog.close();
    void this.router.navigate([...this.base(), 'products'], {
      queryParams: { q: this.searchTerm().trim() || null },
    });
  }
  retry() {
    this.actionError.set(null);
    this.request.reload();
  }
  protected async addToCart(preview: CartPreview, opener: HTMLButtonElement) {
    const shopId = this.shopId();
    const variantId = this.sellableVariantId();
    const control = this.addQuantity();
    const quantity = control.value;
    if (!variantId || control.invalid || quantity === null || this.cartState.locked()) {
      return;
    }
    this.added.set(null);
    const result = await this.cartState.add(variantId, quantity);
    if (this.destroy.destroyed || this.shopId() !== shopId) {
      return;
    }
    if (this.sellableVariantId() === variantId && result !== 'expired') {
      this.added.set(result);
    }
    if (result === 'ok') {
      preview.open(opener);
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
    this.actionError.set(null);
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
      setShopperSession(shopId, result.token);
      forgetGuestCart(shopId, guestToken);
      if (!this.destroy.destroyed && this.shopId() === shopId) {
        const destination = guestToken ? 'cart' : 'account';
        await this.router.navigate([...this.base(), destination], {
          info: guestToken ? new CartMergeNotice(shopId, result.cartMergeIssues) : undefined,
        });
      }
    } catch (error: unknown) {
      const throttled =
        this.page === 'sign-in' &&
        CombinedGraphQLErrors.is(error) &&
        error.errors.some(({ extensions }) => extensions?.['code'] === 'TOO_MANY_REQUESTS');
      this.actionError.set(throttled ? 'signInThrottled' : 'error');
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
    this.actionError.set(null);
    try {
      await this.api.signOut(shopId, token);
      if (sessionStorage.getItem(key) === token) {
        setShopperSession(shopId, null);
      }
      if (!this.destroy.destroyed && this.shopId() === shopId) {
        this.shopper.set(null);
        this.cartState.refreshOwner();
      }
    } catch {
      this.actionError.set('error');
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
const pages: Routes = [
  { path: 's/:shopId', component: StorefrontPage, pathMatch: 'full' },
  { path: 's/:shopId/products', component: StorefrontPage },
  { path: 's/:shopId/product/:id', component: StorefrontPage },
  { path: 's/:shopId/pages/:slug', component: StorefrontPage },
  { path: 's/:shopId/blog', component: StorefrontPage },
  { path: 's/:shopId/blog/:slug', component: StorefrontPage },
  { path: 's/:shopId/contacts', component: StorefrontPage },
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
  { path: 's/:shopId/**', component: StorefrontPage, data: { notFound: true } },
];
// PrimeNG requires its license in the bootstrap providers, before its initializer runs.
async function start(): Promise<void> {
  const license = await loadLocalConfig(readPrimeUiLicense, undefined);
  await bootstrapApplication(StorefrontApp, {
    providers: [
      provideHttpClient(),
      provideRouter(pages, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
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
