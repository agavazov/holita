import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateManualOrderArgs,
  MutationMarkOrderPaidArgs,
  MutationUpdateManualOrderArgs,
  MutationUpdateOrderStatusArgs,
  QueryManualOrderVariantsArgs,
  QueryOrderArgs,
  QueryOrdersArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { OrdersService } from './orders.service.js';

@Resolver()
export class OperatorOrdersResolver {
  constructor(private readonly orders: OrdersService) {}

  @Query('orders')
  list(@Args() args: QueryOrdersArgs, @Context() context: RequestContext) {
    return this.orders.operatorOrders(context, args);
  }

  @Query('orderFilterMethods')
  filterMethods(@Context() context: RequestContext) {
    return this.orders.operatorFilterMethods(context);
  }

  @Query('order')
  order(@Args() { id }: QueryOrderArgs, @Context() context: RequestContext) {
    return this.orders.operatorOrder(context, id);
  }

  @Query('manualOrderMethods')
  methods(@Context() context: RequestContext) {
    return this.orders.manualMethods(context);
  }

  @Query('manualOrderVariants')
  variants(@Args() args: QueryManualOrderVariantsArgs, @Context() context: RequestContext) {
    return this.orders.manualVariants(context, args);
  }

  @Mutation('createManualOrder')
  create(@Args() { input }: MutationCreateManualOrderArgs, @Context() context: RequestContext) {
    return this.orders.createManual(context, input);
  }

  @Mutation('updateManualOrder')
  update(@Args() { id, input }: MutationUpdateManualOrderArgs, @Context() context: RequestContext) {
    return this.orders.updateManual(context, id, input);
  }

  @Mutation('updateOrderStatus')
  updateStatus(@Args() args: MutationUpdateOrderStatusArgs, @Context() context: RequestContext) {
    return this.orders.updateStatus(context, args);
  }

  @Mutation('markOrderPaid')
  markPaid(@Args() { id }: MutationMarkOrderPaidArgs, @Context() context: RequestContext) {
    return this.orders.markPaid(context, id);
  }
}
