import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type {
  MutationCreateProductArgs,
  MutationDeleteProductArgs,
  MutationUpdateProductArgs,
  Product,
  QueryProductArgs,
  QueryProductsArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { ProductsService, type ProductResult } from './products.service.js';

@Resolver('Product')
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Query('products')
  products(@Args() args: QueryProductsArgs, @Context() context: RequestContext) {
    return this.productsService.list(context, args);
  }

  @Query('product')
  product(@Args() args: QueryProductArgs, @Context() context: RequestContext) {
    return this.productsService.find(context, args.id);
  }

  @Mutation('createProduct')
  createProduct(@Args() args: MutationCreateProductArgs, @Context() context: RequestContext) {
    return this.productsService.create(context, args.input);
  }

  @Mutation('updateProduct')
  updateProduct(@Args() args: MutationUpdateProductArgs, @Context() context: RequestContext) {
    return this.productsService.update(context, args.id, args.input);
  }

  @Mutation('deleteProduct')
  deleteProduct(@Args() args: MutationDeleteProductArgs, @Context() context: RequestContext) {
    return this.productsService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(@Parent() reference: Pick<Product, 'id'>, @Context() context: RequestContext) {
    return this.productsService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() product: ProductResult): Store {
    return { __typename: 'Store', id: product.storeId };
  }
}
