import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateBrandArgs,
  MutationDeleteBrandArgs,
  MutationUpdateBrandArgs,
  QueryBrandArgs,
  QueryBrandsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { BrandsService } from './brands.service.js';

@Resolver()
export class BrandsResolver {
  constructor(private readonly service: BrandsService) {}

  @Query('brands')
  brands(@Args() args: QueryBrandsArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('brand')
  brand(@Args() args: QueryBrandArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('createBrand')
  create(@Args() args: MutationCreateBrandArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateBrand')
  update(@Args() args: MutationUpdateBrandArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }

  @Mutation('deleteBrand')
  delete(@Args() args: MutationDeleteBrandArgs, @Context() context: RequestContext) {
    return this.service.delete(context, args.id);
  }
}
