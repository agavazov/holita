import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationRegisterShopperArgs,
  MutationSignInShopperArgs,
  QueryCatalogueArgs,
  QueryCatalogueBrandIndexArgs,
  QueryCatalogueBrandProductsArgs,
  QueryCatalogueCategoryProductsArgs,
  QueryCatalogueTagProductsArgs,
  QueryCatalogueTagsArgs,
  QueryCatalogueBrandsArgs,
  QueryCatalogueCollectionProductsArgs,
  QueryCatalogueCollectionsArgs,
  QueryCatalogueProductArgs,
  QueryCatalogueProductSpecificationsArgs,
} from './generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from './storefront.service.js';

@Resolver()
export class StorefrontResolver {
  constructor(private readonly service: StorefrontService) {}
  @Query('shop') shop(@Context() context: StorefrontContext) {
    return this.service.shop(context);
  }
  @Query('catalogue') catalogue(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueArgs,
  ) {
    return this.service.catalogue(context, args);
  }
  @Query('catalogueProduct') product(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueProductArgs,
  ) {
    return this.service.product(context, args.id);
  }
  @Query('catalogueProductSpecifications') productSpecifications(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueProductSpecificationsArgs,
  ) {
    return this.service.productSpecifications(context, args.productId);
  }
  @Query('catalogueBrands') brands(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueBrandsArgs,
  ) {
    return this.service.catalogueBrands(context, args.offset ?? 0, args.limit ?? 20);
  }
  @Query('catalogueCategories') categories(@Context() context: StorefrontContext) {
    return this.service.catalogueCategories(context);
  }
  @Query('catalogueCollections') collections(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueCollectionsArgs,
  ) {
    return this.service.catalogueCollections(context, args.offset ?? 0, args.limit ?? 20);
  }
  @Query('catalogueBrandIndex') brandIndex(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueBrandIndexArgs,
  ) {
    return this.service.catalogueBrandIndex(context, args.offset ?? 0, args.limit ?? 20);
  }
  @Query('catalogueTags') tags(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueTagsArgs,
  ) {
    return this.service.catalogueTags(context, args.offset ?? 0, args.limit ?? 20);
  }
  @Query('catalogueCategoryProducts') categoryProducts(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueCategoryProductsArgs,
  ) {
    return this.service.catalogueListing(context, 'category', args);
  }
  @Query('catalogueBrandProducts') brandProducts(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueBrandProductsArgs,
  ) {
    return this.service.catalogueListing(context, 'brand', args);
  }
  @Query('catalogueCollectionProducts') collectionProducts(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueCollectionProductsArgs,
  ) {
    return this.service.catalogueListing(context, 'collection', args);
  }
  @Query('catalogueTagProducts') tagProducts(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueTagProductsArgs,
  ) {
    return this.service.catalogueListing(context, 'tag', args);
  }
  @Query('shopperMe') me(@Context() context: StorefrontContext) {
    return this.service.me(context);
  }
  @Mutation('registerShopper') register(
    @Context() context: StorefrontContext,
    @Args() args: MutationRegisterShopperArgs,
  ) {
    return this.service.register(context, args.name, args.email, args.password);
  }
  @Mutation('signInShopper') signIn(
    @Context() context: StorefrontContext,
    @Args() args: MutationSignInShopperArgs,
  ) {
    return this.service.signIn(context, args.email, args.password);
  }
  @Mutation('signOutShopper') signOut(@Context() context: StorefrontContext) {
    return this.service.signOut(context);
  }
}
