import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateCustomerAddressArgs,
  MutationUpdateCustomerAddressArgs,
  MutationUpdateCustomerContactArgs,
  QueryCustomerArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CustomersService } from './customers.service.js';

@Resolver()
export class CustomersResolver {
  constructor(private readonly service: CustomersService) {}

  @Query('customers')
  customers(@Context() context: RequestContext) {
    return this.service.list(context);
  }

  @Query('customer')
  customer(@Args() { id }: QueryCustomerArgs, @Context() context: RequestContext) {
    return this.service.find(context, id);
  }

  @Mutation('updateCustomerContact')
  updateContact(
    @Args() { id, input }: MutationUpdateCustomerContactArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.updateContact(context, id, input);
  }

  @Mutation('createCustomerAddress')
  createAddress(
    @Args() { customerId, input }: MutationCreateCustomerAddressArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.createAddress(context, customerId, input);
  }

  @Mutation('updateCustomerAddress')
  updateAddress(
    @Args() { customerId, addressId, input }: MutationUpdateCustomerAddressArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.updateAddress(context, customerId, addressId, input);
  }
}
