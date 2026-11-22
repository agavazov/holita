import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateProductTagArgs,
  QueryProductTagsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { TagsService } from './tags.service.js';

@Resolver()
export class TagsResolver {
  constructor(private readonly service: TagsService) {}

  @Query('productTags')
  productTags(@Args() args: QueryProductTagsArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Mutation('createProductTag')
  create(@Args() args: MutationCreateProductTagArgs, @Context() context: RequestContext) {
    return this.service.create(context, args.name);
  }
}
