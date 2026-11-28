import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCompleteOrderReturnWithoutRefundArgs,
  MutationDecideOrderReturnArgs,
  MutationRecordOrderReturnRefundArgs,
  QueryOrderReturnArgs,
  QueryOrderReturnsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { ReturnsService } from './returns.service.js';

@Resolver()
export class ReturnsResolver {
  constructor(private readonly returns: ReturnsService) {}

  @Query('orderReturns')
  list(@Args() args: QueryOrderReturnsArgs, @Context() context: RequestContext) {
    return this.returns.list(context, args);
  }

  @Query('orderReturn')
  find(@Args() { id }: QueryOrderReturnArgs, @Context() context: RequestContext) {
    return this.returns.find(context, id);
  }

  @Mutation('decideOrderReturn')
  decide(@Args() args: MutationDecideOrderReturnArgs, @Context() context: RequestContext) {
    return this.returns.decide(context, args);
  }

  @Mutation('recordOrderReturnRefund')
  recordRefund(
    @Args() args: MutationRecordOrderReturnRefundArgs,
    @Context() context: RequestContext,
  ) {
    return this.returns.recordRefund(context, args);
  }

  @Mutation('completeOrderReturnWithoutRefund')
  completeWithoutRefund(
    @Args() args: MutationCompleteOrderReturnWithoutRefundArgs,
    @Context() context: RequestContext,
  ) {
    return this.returns.completeWithoutRefund(context, args);
  }
}
