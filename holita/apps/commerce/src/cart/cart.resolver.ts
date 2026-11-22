import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationAddCartLineArgs,
  MutationRemoveCartLineArgs,
  MutationUpdateCartLineArgs,
} from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { CartService } from './cart.service.js';

@Resolver()
export class CartResolver {
  constructor(
    private readonly carts: CartService,
    private readonly storefront: StorefrontService,
  ) {}

  @Query('cart')
  async cart(@Context() context: StorefrontContext) {
    return this.carts.read(await this.storefront.cartContext(context));
  }

  @Mutation('addCartLine')
  async add(@Context() context: StorefrontContext, @Args() args: MutationAddCartLineArgs) {
    return this.carts.add(
      await this.storefront.cartContext(context),
      args.variantId,
      args.quantity,
    );
  }

  @Mutation('updateCartLine')
  async update(@Context() context: StorefrontContext, @Args() args: MutationUpdateCartLineArgs) {
    return this.carts.update(
      await this.storefront.cartContext(context),
      args.lineId,
      args.quantity,
    );
  }

  @Mutation('removeCartLine')
  async remove(@Context() context: StorefrontContext, @Args() args: MutationRemoveCartLineArgs) {
    return this.carts.remove(await this.storefront.cartContext(context), args.lineId);
  }
}
