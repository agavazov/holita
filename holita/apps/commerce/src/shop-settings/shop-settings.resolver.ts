import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MutationUpdateShopSettingsArgs } from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { ShopSettingsService } from './shop-settings.service.js';

@Resolver()
export class ShopSettingsResolver {
  constructor(private readonly service: ShopSettingsService) {}

  @Query('shopSettings')
  read(@Context() context: RequestContext) {
    return this.service.read(context);
  }

  @Mutation('updateShopSettings')
  update(@Args() args: MutationUpdateShopSettingsArgs, @Context() context: RequestContext) {
    return this.service.update(context, args.input);
  }
}
