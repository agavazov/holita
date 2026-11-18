import { Args, Context, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { MutationReturnErmDeviceToDiscoCanArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { DeviceReference } from '../telemetry/telemetry.service.js';
import { KarmaService } from './karma.service.js';

@Resolver('FleetDevice')
export class KarmaResolver {
  constructor(private readonly karma: KarmaService) {}

  @ResolveField('ermRouting')
  routing(@Parent() device: DeviceReference, @Context() context: RequestContext) {
    return this.karma.deviceRouting(device, context);
  }

  @Mutation('returnErmDeviceToDiscoCan')
  returnToDiscoCan(
    @Args() args: MutationReturnErmDeviceToDiscoCanArgs,
    @Context() context: RequestContext,
  ) {
    return this.karma.requestReturn(args.deviceId, context);
  }
}
