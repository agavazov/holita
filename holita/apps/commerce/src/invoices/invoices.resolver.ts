import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationIssueOrderInvoiceArgs,
  QueryInvoicesArgs,
  QueryOrderInvoiceArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { InvoicesService } from './invoices.service.js';

@Resolver()
export class InvoicesResolver {
  constructor(private readonly invoices: InvoicesService) {}

  @Query('invoices')
  list(@Context() context: RequestContext, @Args() args: QueryInvoicesArgs) {
    return this.invoices.list(context, args);
  }

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
