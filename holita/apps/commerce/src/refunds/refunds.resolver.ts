import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationRecordOrderRefundArgs,
  QueryOrderRefundSummaryArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { RefundsService } from './refunds.service.js';

@Resolver()
export class RefundsResolver {
  constructor(private readonly refunds: RefundsService) {}

  @Query('orderRefundSummary')
  find(@Context() context: RequestContext, @Args() { orderId }: QueryOrderRefundSummaryArgs) {
    return this.refunds.find(context, orderId);
  }

  @Mutation('recordOrderRefund')
  record(
    @Context() context: RequestContext,
    @Args() { orderId, input }: MutationRecordOrderRefundArgs,
  ) {
    return this.refunds.record(context, orderId, input);
  }
}
