import { Args, Query, ResolveReference, Resolver } from '@nestjs/graphql';
import type { QueryStoreArgs, Store } from '../generated/graphql/types.js';
import { StoresService } from './stores.service.js';

@Resolver('Store')
export class StoresResolver {
  constructor(private readonly storesService: StoresService) {}

  @Query('stores')
  stores(): Promise<Store[]> {
    return this.storesService.list();
  }

  @Query('store')
  store(@Args() args: QueryStoreArgs): Promise<Store | null> {
    return this.storesService.find(args.id);
  }

  @ResolveReference()
  resolveReference(reference: Pick<Store, 'id'>): Promise<Store | null> {
    return this.storesService.find(reference.id);
  }
}
