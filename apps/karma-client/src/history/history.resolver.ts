import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type {
  QueryKarmaTripsArgs,
  QueryKarmaEventsArgs,
  QueryKarmaDrivingProfileArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { HistoryService } from './history.service.js';
@Resolver()
export class HistoryResolver {
  constructor(private readonly history: HistoryService) {}
  @Query('karmaTrips') trips(
    @Args() args: QueryKarmaTripsArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.trips(args.input, context);
  }
  @Query('karmaEvents') events(
    @Args() args: QueryKarmaEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.events(args.input, context);
  }
  @Query('karmaDrivingProfile') profile(
    @Args() args: QueryKarmaDrivingProfileArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.profile(args.input, context);
  }
}
