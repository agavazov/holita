import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationAcknowledgeFleetAlertArgs,
  MutationReopenFleetAlertArgs,
  MutationResolveFleetAlertArgs,
  QueryFleetAlertCountsArgs,
  QueryFleetEventArgs,
  QueryFleetEventsArgs,
  QueryFleetManeuverCountsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { EventsService } from './events.service.js';

@Resolver('FleetEvent')
@UseGuards(FleetEnabledGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Query('fleetEvents')
  fleetEvents(@Args() args: QueryFleetEventsArgs, @Context() context: RequestContext) {
    return this.eventsService.list(context, args);
  }

  @Query('fleetEvent')
  fleetEvent(@Args() args: QueryFleetEventArgs, @Context() context: RequestContext) {
    return this.eventsService.find(context, args.id);
  }

  @Query('fleetAlertCounts')
  fleetAlertCounts(@Args() args: QueryFleetAlertCountsArgs, @Context() context: RequestContext) {
    return this.eventsService.alertCounts(context, args);
  }

  @Query('fleetManeuverCounts')
  fleetManeuverCounts(
    @Args() args: QueryFleetManeuverCountsArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.maneuverCounts(context, args);
  }

  @Mutation('acknowledgeFleetAlert')
  acknowledgeFleetAlert(
    @Args() args: MutationAcknowledgeFleetAlertArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.transition(context, 'acknowledge', args.id, args.input);
  }

  @Mutation('resolveFleetAlert')
  resolveFleetAlert(
    @Args() args: MutationResolveFleetAlertArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.transition(context, 'resolve', args.id, args.input);
  }

  @Mutation('reopenFleetAlert')
  reopenFleetAlert(@Args() args: MutationReopenFleetAlertArgs, @Context() context: RequestContext) {
    return this.eventsService.transition(context, 'reopen', args.id, args.input);
  }
}
