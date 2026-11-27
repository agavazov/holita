import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateShopperAddressArgs,
  MutationRemoveShopperAddressArgs,
  MutationUpdateShopperAddressArgs,
} from '../generated/graphql/storefront-types.js';
import { StorefrontService, type StorefrontContext } from '../storefront.service.js';
import { CustomersService } from './customers.service.js';

@Resolver()
export class ShopperAddressesResolver {
  constructor(
    private readonly customers: CustomersService,
    private readonly storefront: StorefrontService,
  ) {}

  @Query('shopperAddresses')
  async addresses(@Context() context: StorefrontContext) {
    return this.customers.addresses(await this.requireOwner(context));
  }

  @Mutation('createShopperAddress')
  async createAddress(
    @Args() { input }: MutationCreateShopperAddressArgs,
    @Context() context: StorefrontContext,
  ) {
    return this.customers.saveAddress(await this.requireOwner(context), input);
  }

  @Mutation('updateShopperAddress')
  async updateAddress(
    @Args() { addressId, input }: MutationUpdateShopperAddressArgs,
    @Context() context: StorefrontContext,
  ) {
    return this.customers.saveAddress(await this.requireOwner(context), input, addressId);
  }

  @Mutation('removeShopperAddress')
  async removeAddress(
    @Args() { addressId }: MutationRemoveShopperAddressArgs,
    @Context() context: StorefrontContext,
  ) {
    return this.customers.removeAddress(await this.requireOwner(context), addressId);
  }

  private requireOwner(context: StorefrontContext) {
    return this.storefront.requireShopper(context, 'manage your addresses');
  }
}
