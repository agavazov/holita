import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateCustomerAddressArgs,
  MutationExportCustomerDataArgs,
  MutationRemoveCustomerAddressArgs,
  MutationUpdateCustomerAddressArgs,
  MutationUpdateCustomerContactArgs,
  QueryCustomerArgs,
  QueryCustomerContactArgs,
  QueryCustomersArgs,
} from '../generated/graphql/types.js';
import { requireScope, type RequestContext } from '../scope.js';
import { CustomersService } from './customers.service.js';

@Resolver()
export class CustomersResolver {
  constructor(private readonly service: CustomersService) {}

  @Query('customers')
  customers(@Args() args: QueryCustomersArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('customerContact')
  contact(@Args() { id }: QueryCustomerContactArgs, @Context() context: RequestContext) {
    return this.service.contact(context, id);
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

  @Mutation('exportCustomerData')
  exportData(
    @Args() { customerId }: MutationExportCustomerDataArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.exportData(context, customerId);
  }

  @Mutation('createCustomerAddress')
  async createAddress(
    @Args() { customerId, input }: MutationCreateCustomerAddressArgs,
    @Context() context: RequestContext,
  ) {
    const scope = await requireScope(context, true);
    return this.service.saveAddress({ ...scope, customerId }, input);
  }

  @Mutation('updateCustomerAddress')
  async updateAddress(
    @Args() { customerId, addressId, input }: MutationUpdateCustomerAddressArgs,
    @Context() context: RequestContext,
  ) {
    const scope = await requireScope(context, true);
    return this.service.saveAddress({ ...scope, customerId }, input, addressId);
  }

  @Mutation('removeCustomerAddress')
  async removeAddress(
    @Args() { customerId, addressId }: MutationRemoveCustomerAddressArgs,
    @Context() context: RequestContext,
  ) {
    const scope = await requireScope(context, true);
    return this.service.removeAddress({ ...scope, customerId }, addressId);
  }
}
