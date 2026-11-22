import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateShopPageArgs,
  MutationUpdateShopPageArgs,
  QueryShopPageArgs,
  QueryShopPagesArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { PagesService } from './pages.service.js';

@Resolver()
export class PagesResolver {
  constructor(private readonly pages: PagesService) {}

  @Query('shopPages')
  list(@Args() args: QueryShopPagesArgs, @Context() context: RequestContext) {
    return this.pages.list(context, args);
  }

  @Query('shopPage')
  find(@Args() args: QueryShopPageArgs, @Context() context: RequestContext) {
    return this.pages.find(context, args.id);
  }

  @Mutation('createShopPage')
  create(@Args() args: MutationCreateShopPageArgs, @Context() context: RequestContext) {
    return this.pages.save(context, args.input);
  }

  @Mutation('updateShopPage')
  update(@Args() args: MutationUpdateShopPageArgs, @Context() context: RequestContext) {
    return this.pages.save(context, args.input, args.id);
  }
}
