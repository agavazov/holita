import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateLeadTaskArgs,
  MutationUpdateLeadTaskArgs,
  MutationUpdateLeadTaskStatusArgs,
  QueryLeadTaskArgs,
  QueryLeadTasksArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { LeadTasksService } from './lead-tasks.service.js';

@Resolver()
export class LeadTasksResolver {
  constructor(private readonly tasks: LeadTasksService) {}

  @Query()
  async leadTasks(@Context() context: RequestContext, @Args() { leadId }: QueryLeadTasksArgs) {
    return this.tasks.list(await requireSalesScope(context), leadId);
  }

  @Query()
  async leadTask(@Context() context: RequestContext, @Args() { leadId, id }: QueryLeadTaskArgs) {
    return this.tasks.find(await requireSalesScope(context), leadId, id);
  }

  @Mutation()
  async createLeadTask(
    @Context() context: RequestContext,
    @Args() { leadId, input }: MutationCreateLeadTaskArgs,
  ) {
    return this.tasks.create(await requireSalesScope(context), leadId, input);
  }

  @Mutation()
  async updateLeadTask(
    @Context() context: RequestContext,
    @Args() { leadId, id, input }: MutationUpdateLeadTaskArgs,
  ) {
    return this.tasks.update(await requireSalesScope(context), leadId, id, input);
  }

  @Mutation()
  async updateLeadTaskStatus(
    @Context() context: RequestContext,
    @Args() { leadId, id, status }: MutationUpdateLeadTaskStatusArgs,
  ) {
    return this.tasks.updateStatus(await requireSalesScope(context), leadId, id, status);
  }
}
