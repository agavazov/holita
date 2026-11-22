import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationMarkOrderPaidArgs,
  MutationUpdateOrderStatusArgs,
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

  @Query('order')
  order(@Args() { id }: QueryOrderArgs, @Context() context: RequestContext) {
    return this.orders.operatorOrder(context, id);
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
