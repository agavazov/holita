import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationPlaceOrderArgs,
  QueryOrderConfirmationArgs,
} from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { OrdersService } from './orders.service.js';

@Resolver()
export class OrdersResolver {
  constructor(
    private readonly orders: OrdersService,
    private readonly storefront: StorefrontService,
  ) {}

  @Query('orderConfirmation')
  async confirmation(
    @Context() context: StorefrontContext,
    @Args() { orderId }: QueryOrderConfirmationArgs,
  ) {
    return this.orders.confirmation(await this.storefront.cartContext(context), orderId);
  }

  @Mutation('placeOrder')
  async place(@Context() context: StorefrontContext, @Args() { input }: MutationPlaceOrderArgs) {
    return this.orders.place(await this.storefront.cartContext(context), input);
  }
}
