import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateLeadArgs,
  MutationUpdateLeadArgs,
  MutationUpdateLeadStageArgs,
  QueryLeadArgs,
  QueryLeadsArgs,
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
}
