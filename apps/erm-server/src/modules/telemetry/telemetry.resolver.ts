import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type {
  QueryErmCommandsArgs,
  QueryErmEventsArgs,
  QueryErmFramesArgs,
  QueryErmUnitsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { TelemetryService } from './telemetry.service.js';

@Resolver()
export class TelemetryResolver {
  constructor(private readonly telemetry: TelemetryService) {}

  @Query('ermUnits') units(@Args() args: QueryErmUnitsArgs, @Context() context: RequestContext) {
    return this.telemetry.units(args.input, context);
  }

  @Query('ermEvents') events(@Args() args: QueryErmEventsArgs, @Context() context: RequestContext) {
    return this.telemetry.events(args.input, context);
  }

  @Query('ermFrames') frames(@Args() args: QueryErmFramesArgs, @Context() context: RequestContext) {
    return this.telemetry.frames(args.input, context);
  }

  @Query('ermCommands') commands(
    @Args() args: QueryErmCommandsArgs,
    @Context() context: RequestContext,
  ) {
    return this.telemetry.commands(args.input, context);
  }
}
