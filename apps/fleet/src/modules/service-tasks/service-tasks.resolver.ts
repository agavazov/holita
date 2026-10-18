import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationCancelFleetServiceTaskArgs,
  MutationCompleteFleetServiceTaskArgs,
  MutationCreateFleetServiceTaskArgs,
  MutationDeleteFleetServiceTaskArgs,
  MutationUpdateFleetServiceTaskArgs,
  QueryFleetServiceTaskArgs,
  QueryFleetServiceTasksArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { ServiceTasksService } from './service-tasks.service.js';

@Resolver('FleetServiceTask')
@UseGuards(FleetEnabledGuard)
export class ServiceTasksResolver {
  constructor(private readonly serviceTasksService: ServiceTasksService) {}

  @Query('fleetServiceTasks')
  fleetServiceTasks(@Args() args: QueryFleetServiceTasksArgs, @Context() context: RequestContext) {
    return this.serviceTasksService.list(context, args);
  }

  @Query('fleetServiceTask')
  fleetServiceTask(@Args() args: QueryFleetServiceTaskArgs, @Context() context: RequestContext) {
    return this.serviceTasksService.find(context, args.id);
  }

  @Query('fleetServiceSummary')
  fleetServiceSummary(@Context() context: RequestContext) {
    return this.serviceTasksService.summary(context);
  }

  @Mutation('createFleetServiceTask')
  createFleetServiceTask(
    @Args() args: MutationCreateFleetServiceTaskArgs,
    @Context() context: RequestContext,
  ) {
    return this.serviceTasksService.create(context, args.input);
  }

  @Mutation('updateFleetServiceTask')
  updateFleetServiceTask(
    @Args() args: MutationUpdateFleetServiceTaskArgs,
    @Context() context: RequestContext,
  ) {
    return this.serviceTasksService.update(context, args.id, args.input);
  }

  @Mutation('completeFleetServiceTask')
  completeFleetServiceTask(
    @Args() args: MutationCompleteFleetServiceTaskArgs,
    @Context() context: RequestContext,
  ) {
    return this.serviceTasksService.complete(context, args.id, args.input);
  }

  @Mutation('cancelFleetServiceTask')
  cancelFleetServiceTask(
    @Args() args: MutationCancelFleetServiceTaskArgs,
    @Context() context: RequestContext,
  ) {
    return this.serviceTasksService.cancel(context, args.id);
  }

  @Mutation('deleteFleetServiceTask')
  deleteFleetServiceTask(
    @Args() args: MutationDeleteFleetServiceTaskArgs,
    @Context() context: RequestContext,
  ) {
    return this.serviceTasksService.delete(context, args.id);
  }
}
