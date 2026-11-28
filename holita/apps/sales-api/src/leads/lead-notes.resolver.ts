import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateLeadNoteArgs,
  MutationDeleteLeadNoteArgs,
  MutationUpdateLeadNoteArgs,
  QueryLeadNoteArgs,
  QueryLeadNotesArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { LeadNotesService } from './lead-notes.service.js';

@Resolver()
export class LeadNotesResolver {
  constructor(private readonly notes: LeadNotesService) {}

  @Query()
  async leadNotes(@Context() context: RequestContext, @Args() { leadId }: QueryLeadNotesArgs) {
    return this.notes.list(await requireSalesScope(context), leadId);
  }

  @Query()
  async leadNote(@Context() context: RequestContext, @Args() { leadId, id }: QueryLeadNoteArgs) {
    return this.notes.find(await requireSalesScope(context), leadId, id);
  }

  @Mutation()
  async createLeadNote(
    @Context() context: RequestContext,
    @Args() { leadId, input }: MutationCreateLeadNoteArgs,
  ) {
    return this.notes.create(await requireSalesScope(context), leadId, input);
  }

  @Mutation()
  async updateLeadNote(
    @Context() context: RequestContext,
    @Args() { leadId, id, input }: MutationUpdateLeadNoteArgs,
  ) {
    return this.notes.update(await requireSalesScope(context), leadId, id, input);
  }

  @Mutation()
  async deleteLeadNote(
    @Context() context: RequestContext,
    @Args() { leadId, id }: MutationDeleteLeadNoteArgs,
  ) {
    return this.notes.delete(await requireSalesScope(context), leadId, id);
  }
}
