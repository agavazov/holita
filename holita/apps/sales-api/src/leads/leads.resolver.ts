import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationConvertWonLeadArgs,
  MutationCreateLeadArgs,
  MutationUpdateLeadArgs,
  MutationUpdateLeadAssignmentArgs,
  MutationUpdateLeadStageArgs,
  QueryLeadArgs,
  QueryLeadsArgs,
  QuerySalesAgentsArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { LeadsService } from './leads.service.js';

@Resolver()
export class LeadsResolver {
  constructor(private readonly leadsService: LeadsService) {}

  @Query()
  async leads(@Context() context: RequestContext, @Args() args: QueryLeadsArgs) {
    return this.leadsService.list(await requireSalesScope(context), args);
  }

  @Query()
  async lead(@Context() context: RequestContext, @Args() { id }: QueryLeadArgs) {
    return this.leadsService.find(await requireSalesScope(context), id);
  }

  @Query()
  async salesAgents(@Context() context: RequestContext, @Args() args: QuerySalesAgentsArgs) {
    return this.leadsService.salesAgents(await requireSalesScope(context), args);
  }

  @Query()
  async leadAssignmentAgents(@Context() context: RequestContext) {
    return this.leadsService.leadAssignmentAgents(await requireSalesScope(context));
  }

  @Mutation()
  async createLead(@Context() context: RequestContext, @Args() { input }: MutationCreateLeadArgs) {
    return this.leadsService.create(await requireSalesScope(context), input);
  }

  @Mutation()
  async updateLead(
    @Context() context: RequestContext,
    @Args() { id, input }: MutationUpdateLeadArgs,
  ) {
    return this.leadsService.update(await requireSalesScope(context), id, input);
  }

  @Mutation()
  async updateLeadStage(
    @Context() context: RequestContext,
    @Args() { id, stage }: MutationUpdateLeadStageArgs,
  ) {
    return this.leadsService.updateStage(await requireSalesScope(context), id, stage);
  }

  @Mutation()
  async convertWonLead(
    @Context() context: RequestContext,
    @Args() args: MutationConvertWonLeadArgs,
  ) {
    return this.leadsService.convertWonLead(await requireSalesScope(context), args);
  }

  @Mutation()
  async updateLeadAssignment(
    @Context() context: RequestContext,
    @Args() { id, assignedAgentUserId }: MutationUpdateLeadAssignmentArgs,
  ) {
    return this.leadsService.updateAssignment(
      await requireSalesScope(context),
      id,
      assignedAgentUserId ?? null,
    );
  }
}
