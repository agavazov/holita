import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { RequestContext } from '../../graphql/request-context.js';
import type { QueryKarmaLocationArgs } from '../../generated/graphql/types.js';
import { LocationService } from './location.service.js';

@Resolver()
export class LocationResolver {
  constructor(private readonly service: LocationService) {}

  @Query('karmaLocation')
  karmaLocation(@Args() args: QueryKarmaLocationArgs, @Context() context: RequestContext) {
    return this.service.find(args.carId, context);
  }
}
