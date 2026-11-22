import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationPlaceOrderArgs,
  QueryGuestOrderConfirmationArgs,
  QueryOrderConfirmationArgs,
  QueryShopperOrderArgs,
  QueryShopperOrdersArgs,
} from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { OrdersService } from './orders.service.js';

@Resolver()
export class OrdersResolver {
  constructor(
    private readonly orders: OrdersService,
    private readonly storefront: StorefrontService,
  ) {}

  @Query('shopperOrders')
  async shopperOrders(@Context() context: StorefrontContext, @Args() args: QueryShopperOrdersArgs) {
    return this.orders.shopperOrders(await this.storefront.requireShopper(context), args);
  }

  @Query('shopperOrder')
  async shopperOrder(@Context() context: StorefrontContext, @Args() { id }: QueryShopperOrderArgs) {
    return this.orders.shopperOrder(await this.storefront.requireShopper(context), id);
  }

  @Query('orderConfirmation')
  async confirmation(
    @Context() context: StorefrontContext,
    @Args() { orderId }: QueryOrderConfirmationArgs,
  ) {
    return this.orders.confirmation(await this.storefront.cartContext(context), orderId);
  }

  @Query('guestOrderConfirmation')
  async guestConfirmation(
    @Context() context: StorefrontContext,
    @Args() { cartId }: QueryGuestOrderConfirmationArgs,
  ) {
    return this.orders.guestConfirmation(await this.storefront.cartContext(context), cartId);
  }

  @Mutation('placeOrder')
  async place(@Context() context: StorefrontContext, @Args() { input }: MutationPlaceOrderArgs) {
    return this.orders.place(await this.storefront.cartContext(context), input);
  }
}
