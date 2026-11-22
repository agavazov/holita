import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateProductArgs,
  MutationUpdateProductArgs,
  QueryProductArgs,
  QueryProductsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CommerceService } from './commerce.service.js';

@Resolver()
export class CommerceResolver {
  constructor(private readonly service: CommerceService) {}

  @Query('products')
  products(@Args() args: QueryProductsArgs, @Context() context: RequestContext) {
    return this.service.products(context, args);
  }

  @Query('product')
  product(@Args() args: QueryProductArgs, @Context() context: RequestContext) {
    return this.service.product(context, args.id);
  }

  @Mutation('createProduct')
  create(@Args() args: MutationCreateProductArgs, @Context() context: RequestContext) {
    return this.service.create(context, args.input);
  }

  @Mutation('updateProduct')
  update(@Args() args: MutationUpdateProductArgs, @Context() context: RequestContext) {
    return this.service.update(context, args.id, args.input);
  }
}
