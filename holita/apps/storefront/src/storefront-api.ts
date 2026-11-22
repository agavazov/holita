import { inject, Injectable } from '@angular/core';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  AddCartLineDocument,
  CatalogueBrandIndexDocument,
  CatalogueBrandProductsDocument,
  CatalogueCategoriesDocument,
  CatalogueCategoryProductsDocument,
  CatalogueCollectionProductsDocument,
  CatalogueCollectionsDocument,
  CatalogueDocument,
  CatalogueProductDocument,
  CatalogueTagProductsDocument,
  CatalogueTagsDocument,
  CheckoutDocument,
  OrderConfirmationDocument,
  PlaceOrderDocument,
  PublicCartDocument,
  PublicShopDocument,
  QuoteCheckoutDocument,
  RegisterShopperDocument,
  RemoveCartLineDocument,
  ShopperMeDocument,
  SignInShopperDocument,
  SignOutShopperDocument,
  UpdateCartLineDocument,
  type CatalogueBrowsePageFragment,
  type CatalogueCategoryFieldsFragment,
  type CatalogueQueryVariables,
  type CheckoutQuoteInput,
  type PlaceOrderInput,
} from './generated/operations';
import type { BrowseSection } from './catalogue-url';

export interface IndexEntry {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
}

export interface BrowseIndex {
  items: IndexEntry[];
  categories?: CatalogueCategoryFieldsFragment[];
  total: number;
}

export interface StorefrontCredentials {
  readonly shopperToken?: string | null;
  readonly guestCartToken?: string | null;
}

function requestHeaders(shopId: string, credentials: StorefrontCredentials) {
  const { shopperToken, guestCartToken } = credentials;
  return {
    'x-branch-id': shopId,
    ...(shopperToken ? { authorization: `Bearer ${shopperToken}` } : {}),
    ...(guestCartToken ? { 'x-cart-token': guestCartToken } : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class StorefrontApi {
  private readonly apollo = inject(Apollo);
  private async read<Data, Variables extends Record<string, unknown>>(
    shopId: string,
    query: TypedDocumentNode<Data, Variables>,
    variables: Variables,
    credentials: StorefrontCredentials = {},
  ): Promise<Data> {
    const { data } = await firstValueFrom(
      this.apollo.query({
        query,
        variables,
        fetchPolicy: 'no-cache',
        context: { headers: requestHeaders(shopId, credentials), queryDeduplication: false },
      }),
    );
    if (!data) {
      throw new Error('Missing storefront response');
    }
    return data;
  }

  private async write<Data, Variables extends Record<string, unknown>>(
    shopId: string,
    mutation: TypedDocumentNode<Data, Variables>,
    variables: Variables,
    credentials: StorefrontCredentials,
  ) {
    const { data } = await firstValueFrom(
      this.apollo.mutate({
        mutation,
        variables,
        fetchPolicy: 'no-cache',
        context: { headers: requestHeaders(shopId, credentials) },
      }),
    );
    if (!data) {
      throw new Error('Missing storefront response');
    }
    return data;
  }

  async listing(
    shopId: string,
    section: BrowseSection | null,
    slug: string | null,
    variables: CatalogueQueryVariables,
  ): Promise<CatalogueBrowsePageFragment | null> {
    if (!section || slug === null) {
      return (await this.read(shopId, CatalogueDocument, variables)).catalogue;
    }
    const args = { ...variables, slug };
    switch (section) {
      case 'categories':
        return (await this.read(shopId, CatalogueCategoryProductsDocument, args))
          .catalogueCategoryProducts;
      case 'brands':
        return (await this.read(shopId, CatalogueBrandProductsDocument, args))
          .catalogueBrandProducts;
      case 'collections':
        return (await this.read(shopId, CatalogueCollectionProductsDocument, args))
          .catalogueCollectionProducts;
      case 'tags':
        return (await this.read(shopId, CatalogueTagProductsDocument, args)).catalogueTagProducts;
    }
  }

  async index(
    shopId: string,
    section: BrowseSection,
    variables: { offset: number; limit: number },
  ): Promise<BrowseIndex> {
    switch (section) {
      case 'categories': {
        const { catalogueCategories } = await this.read(shopId, CatalogueCategoriesDocument, {});
        const items = catalogueCategories.filter((entry) => entry.parentId === null);
        return { items, categories: catalogueCategories, total: items.length };
      }
      case 'brands':
        return (await this.read(shopId, CatalogueBrandIndexDocument, variables))
          .catalogueBrandIndex;
      case 'collections':
        return (await this.read(shopId, CatalogueCollectionsDocument, variables))
          .catalogueCollections;
      case 'tags':
        return (await this.read(shopId, CatalogueTagsDocument, variables)).catalogueTags;
    }
  }

  async shop(shopId: string) {
    return (await this.read(shopId, PublicShopDocument, {})).shop;
  }
  product(shopId: string, id: string) {
    return this.read(shopId, CatalogueProductDocument, { id });
  }
  async me(shopId: string, shopperToken: string | null) {
    return (await this.read(shopId, ShopperMeDocument, {}, { shopperToken })).shopperMe;
  }

  async register(
    shopId: string,
    input: { name: string; email: string; password: string },
    guestCartToken: string | null,
  ) {
    return (await this.write(shopId, RegisterShopperDocument, input, { guestCartToken }))
      .registerShopper;
  }
  async signIn(
    shopId: string,
    input: { email: string; password: string },
    guestCartToken: string | null,
  ) {
    return (await this.write(shopId, SignInShopperDocument, input, { guestCartToken }))
      .signInShopper;
  }
  signOut(shopId: string, shopperToken: string | null) {
    return this.write(shopId, SignOutShopperDocument, {}, { shopperToken });
  }

  async cart(shopId: string, credentials: StorefrontCredentials) {
    return (await this.read(shopId, PublicCartDocument, {}, credentials)).cart;
  }
  async addCartLine(
    shopId: string,
    credentials: StorefrontCredentials,
    variantId: string,
    quantity: number,
  ) {
    return (await this.write(shopId, AddCartLineDocument, { variantId, quantity }, credentials))
      .addCartLine;
  }
  async updateCartLine(
    shopId: string,
    credentials: StorefrontCredentials,
    lineId: string,
    quantity: number,
  ) {
    return (await this.write(shopId, UpdateCartLineDocument, { lineId, quantity }, credentials))
      .updateCartLine;
  }
  async removeCartLine(shopId: string, credentials: StorefrontCredentials, lineId: string) {
    return (await this.write(shopId, RemoveCartLineDocument, { lineId }, credentials))
      .removeCartLine;
  }

  async checkout(shopId: string, credentials: StorefrontCredentials) {
    return (await this.read(shopId, CheckoutDocument, {}, credentials)).checkout;
  }

  async quoteCheckout(
    shopId: string,
    credentials: StorefrontCredentials,
    input: CheckoutQuoteInput,
  ) {
    return (await this.write(shopId, QuoteCheckoutDocument, { input }, credentials)).quoteCheckout;
  }

  async placeOrder(shopId: string, credentials: StorefrontCredentials, input: PlaceOrderInput) {
    return (await this.write(shopId, PlaceOrderDocument, { input }, credentials)).placeOrder;
  }

  async orderConfirmation(shopId: string, credentials: StorefrontCredentials, orderId: string) {
    return (await this.read(shopId, OrderConfirmationDocument, { orderId }, credentials))
      .orderConfirmation;
  }
}
