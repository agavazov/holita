import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationRegisterShopperArgs,
  MutationSignInShopperArgs,
  QueryCatalogueArgs,
  QueryCatalogueBrandsArgs,
  QueryCatalogueProductArgs,
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
    return this.service.catalogue(context, args.offset ?? 0, args.limit ?? 20);
  }
  @Query('catalogueProduct') product(
    @Context() context: StorefrontContext,
    @Args() args: QueryCatalogueProductArgs,
  ) {
    return this.service.product(context, args.id);
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
