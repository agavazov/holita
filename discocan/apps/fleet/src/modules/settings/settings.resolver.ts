import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type { MutationUpdateFleetSettingsArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { SettingsService } from './settings.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class SettingsResolver {
  constructor(private readonly settings: SettingsService) {}

  @Query('fleetSettings')
  fleetSettings(@Context() context: RequestContext) {
    return this.settings.find(context);
  }

  @Mutation('updateFleetSettings')
  updateFleetSettings(
    @Args() args: MutationUpdateFleetSettingsArgs,
    @Context() context: RequestContext,
  ) {
    return this.settings.update(context, args.input);
  }
}
