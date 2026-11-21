import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateCategoryArgs,
  MutationDeleteCategoryArgs,
  MutationUpdateCategoryArgs,
  QueryCategoryArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CategoriesService } from './categories.service.js';

@Resolver()
export class CategoriesResolver {
  constructor(private readonly service: CategoriesService) {}

  @Query('categories')
  categories(@Context() context: RequestContext) {
    return this.service.list(context);
  }

  @Query('category')
  category(@Args() args: QueryCategoryArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('createCategory')
  create(@Args() args: MutationCreateCategoryArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateCategory')
  update(@Args() args: MutationUpdateCategoryArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }

  @Mutation('deleteCategory')
  delete(@Args() args: MutationDeleteCategoryArgs, @Context() context: RequestContext) {
    return this.service.delete(context, args.id);
  }
}
