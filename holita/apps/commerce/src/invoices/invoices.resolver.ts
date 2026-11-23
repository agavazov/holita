import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationIssueOrderInvoiceArgs,
  MutationIssueStandaloneInvoiceArgs,
  MutationUpdateInvoiceIssuerSettingsArgs,
  QueryInvoiceArgs,
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

  @Query('invoice')
  findById(@Context() context: RequestContext, @Args() { id }: QueryInvoiceArgs) {
    return this.invoices.findById(context, id);
  }

  @Query('invoiceIssuerSettings')
  readIssuerSettings(@Context() context: RequestContext) {
    return this.invoices.readIssuerSettings(context);
  }

  @Mutation('updateInvoiceIssuerSettings')
  updateIssuerSettings(
    @Context() context: RequestContext,
    @Args() { input }: MutationUpdateInvoiceIssuerSettingsArgs,
  ) {
    return this.invoices.updateIssuerSettings(context, input);
  }

  @Mutation('issueStandaloneInvoice')
  issueStandalone(
    @Context() context: RequestContext,
    @Args() { input }: MutationIssueStandaloneInvoiceArgs,
  ) {
    return this.invoices.issueStandalone(context, input);
  }

  @Mutation('issueOrderInvoice')
  issue(
    @Context() context: RequestContext,
    @Args() { orderId, input }: MutationIssueOrderInvoiceArgs,
  ) {
    return this.invoices.issue(context, orderId, input);
  }
}
