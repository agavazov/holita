import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateProductCollectionArgs,
  MutationUpdateProductCollectionArgs,
  QueryProductCollectionArgs,
  QueryProductCollectionsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CollectionsService } from './collections.service.js';

@Resolver()
export class CollectionsResolver {
  constructor(private readonly service: CollectionsService) {}

  @Query('productCollections')
  collections(@Args() args: QueryProductCollectionsArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('productCollection')
  collection(@Args() args: QueryProductCollectionArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('createProductCollection')
  create(@Args() args: MutationCreateProductCollectionArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateProductCollection')
  update(@Args() args: MutationUpdateProductCollectionArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }
}
