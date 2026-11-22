import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MutationQuoteCheckoutArgs } from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { CheckoutService } from './checkout.service.js';

@Resolver()
export class CheckoutResolver {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly storefront: StorefrontService,
  ) {}

  @Query('checkout')
  async checkout(@Context() context: StorefrontContext) {
    return this.checkoutService.read(await this.storefront.cartContext(context));
  }

  @Mutation('quoteCheckout')
  async quote(@Context() context: StorefrontContext, @Args() { input }: MutationQuoteCheckoutArgs) {
    return this.checkoutService.quote(await this.storefront.cartContext(context), input);
  }
}
