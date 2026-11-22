import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreatePaymentMethodArgs,
  MutationUpdatePaymentMethodArgs,
  QueryPaymentMethodArgs,
  QueryPaymentMethodsArgs,
  MutationCreateShippingMethodArgs,
  MutationUpdateShippingMethodArgs,
  QueryShippingMethodArgs,
  QueryShippingMethodsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { ManualMethodsService } from './manual-methods.service.js';

@Resolver()
export class ManualMethodsResolver {
  constructor(private readonly service: ManualMethodsService) {}

  @Query('paymentMethods')
  paymentMethods(@Args() args: QueryPaymentMethodsArgs, @Context() context: RequestContext) {
    return this.service.listPaymentMethods(context, args);
  }

  @Query('paymentMethod')
  paymentMethod(@Args() args: QueryPaymentMethodArgs, @Context() context: RequestContext) {
    return this.service.findPaymentMethod(context, args.id);
  }

  @Mutation('createPaymentMethod')
  createPaymentMethod(
    @Args() args: MutationCreatePaymentMethodArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.savePaymentMethod(context, args.input);
  }

  @Mutation('updatePaymentMethod')
  updatePaymentMethod(
    @Args() args: MutationUpdatePaymentMethodArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.savePaymentMethod(context, args.input, args.id);
  }

  @Query('shippingMethods')
  shippingMethods(@Args() args: QueryShippingMethodsArgs, @Context() context: RequestContext) {
    return this.service.listShippingMethods(context, args);
  }

  @Query('shippingMethod')
  shippingMethod(@Args() args: QueryShippingMethodArgs, @Context() context: RequestContext) {
    return this.service.findShippingMethod(context, args.id);
  }

  @Mutation('createShippingMethod')
  createShippingMethod(
    @Args() args: MutationCreateShippingMethodArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.saveShippingMethod(context, args.input);
  }

  @Mutation('updateShippingMethod')
  updateShippingMethod(
    @Args() args: MutationUpdateShippingMethodArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.saveShippingMethod(context, args.input, args.id);
  }
}
