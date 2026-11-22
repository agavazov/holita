import { inject, Injectable } from '@angular/core';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
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
  PublicShopDocument,
  RegisterShopperDocument,
  ShopperMeDocument,
  SignInShopperDocument,
  SignOutShopperDocument,
  type CatalogueBrowsePageFragment,
  type CatalogueCategoryFieldsFragment,
  type CatalogueQueryVariables,
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

@Injectable({ providedIn: 'root' })
export class StorefrontApi {
  private readonly apollo = inject(Apollo);
  private async read<Data, Variables extends Record<string, unknown>>(
    shopId: string,
    query: TypedDocumentNode<Data, Variables>,
    variables: Variables,
  ): Promise<Data> {
    const { data } = await firstValueFrom(
      this.apollo.query({
        query,
        variables,
        fetchPolicy: 'no-cache',
        context: { shopId, queryDeduplication: false },
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
  async me(shopId: string) {
    return (await this.read(shopId, ShopperMeDocument, {})).shopperMe;
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
