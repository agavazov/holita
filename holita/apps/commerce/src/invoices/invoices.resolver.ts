import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationIssueOrderInvoiceArgs,
  QueryOrderInvoiceArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { InvoicesService } from './invoices.service.js';

@Resolver()
export class InvoicesResolver {
  constructor(private readonly invoices: InvoicesService) {}

  @Query('orderInvoice')
  find(@Context() context: RequestContext, @Args() { orderId }: QueryOrderInvoiceArgs) {
    return this.invoices.find(context, orderId);
  }

  @Mutation('issueOrderInvoice')
  issue(
    @Context() context: RequestContext,
    @Args() { orderId, input }: MutationIssueOrderInvoiceArgs,
  ) {
    return this.invoices.issue(context, orderId, input);
  }
}
