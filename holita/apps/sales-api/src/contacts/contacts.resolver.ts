import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateLeadContactArgs,
  MutationDeleteLeadContactArgs,
  MutationUpdateLeadContactArgs,
  QueryLeadContactArgs,
  QueryLeadContactsArgs,
  QuerySalesContactsArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { ContactsService } from './contacts.service.js';

@Resolver()
export class ContactsResolver {
  constructor(private readonly contacts: ContactsService) {}

  @Query()
  async leadContacts(
    @Context() context: RequestContext,
    @Args() { leadId }: QueryLeadContactsArgs,
  ) {
    return this.contacts.listForLead(await requireSalesScope(context), leadId);
  }

  @Query()
  async leadContact(
    @Context() context: RequestContext,
    @Args() { leadId, id }: QueryLeadContactArgs,
  ) {
    return this.contacts.find(await requireSalesScope(context), leadId, id);
  }

  @Query()
  async salesContacts(@Context() context: RequestContext, @Args() args: QuerySalesContactsArgs) {
    return this.contacts.list(await requireSalesScope(context), args);
  }

  @Mutation()
  async createLeadContact(
    @Context() context: RequestContext,
    @Args() { leadId, input }: MutationCreateLeadContactArgs,
  ) {
    return this.contacts.save(await requireSalesScope(context), leadId, input);
  }

  @Mutation()
  async updateLeadContact(
    @Context() context: RequestContext,
    @Args() { leadId, id, input }: MutationUpdateLeadContactArgs,
  ) {
    return this.contacts.save(await requireSalesScope(context), leadId, input, id);
  }

  @Mutation()
  async deleteLeadContact(
    @Context() context: RequestContext,
    @Args() { leadId, id }: MutationDeleteLeadContactArgs,
  ) {
    return this.contacts.delete(await requireSalesScope(context), leadId, id);
  }
}
