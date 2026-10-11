import { Args, Context, Parent, Query, ResolveReference, Resolver } from '@nestjs/graphql';
import type { QueryStoreArgs, Store } from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { StoresService } from './stores.service.js';

@Resolver('Store')
export class StoresResolver {
  constructor(private readonly storesService: StoresService) {}

  @Query('stores')
  stores(@Context() context: RequestContext): Promise<Store[]> {
    return this.storesService.list(context);
  }

  @Query('store')
  store(@Args() args: QueryStoreArgs, @Context() context: RequestContext): Promise<Store | null> {
    return this.storesService.find(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<Store, 'id'>,
    @Context() context: RequestContext,
  ): Promise<Store | null> {
    return this.storesService.find(context, reference.id);
  }
}
