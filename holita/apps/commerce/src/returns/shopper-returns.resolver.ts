import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import type { MutationRequestShopperReturnArgs } from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { ReturnsService } from './returns.service.js';

@Resolver()
export class ShopperReturnsResolver {
  constructor(
    private readonly returns: ReturnsService,
    private readonly storefront: StorefrontService,
  ) {}

  @Mutation('requestShopperReturn')
  async request(
    @Context() context: StorefrontContext,
    @Args() { input }: MutationRequestShopperReturnArgs,
  ) {
    const shopper = await this.storefront.requireShopperAccount(context, 'request a return');
    return this.returns.request(shopper, input, context.emailLanguage ?? 'bg');
  }
}
