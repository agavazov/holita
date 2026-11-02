import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationRequestFleetDeviceConfigurationReadArgs,
  MutationRequestFleetDeviceParameterAdditionArgs,
  MutationRequestFleetDeviceParameterIntervalUpdateArgs,
  QueryFleetDeviceOperationArgs,
  QueryFleetDeviceOperationsArgs,
  QueryFleetDeviceConfigurationSnapshotArgs,
  QueryFleetDeviceRulesSnapshotArgs,
  MutationRequestFleetDeviceRulesReadArgs,
  MutationRequestFleetDeviceRuleChangeArgs,
  MutationRequestFleetDeviceDiagnosticReadArgs,
  QueryFleetDeviceDiagnosticOperationsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DeviceOperationsService } from './device-operations.service.js';

@Resolver()
@UseGuards(FleetEnabledGuard)
export class DeviceOperationsResolver {
  constructor(private readonly operations: DeviceOperationsService) {}

  @Mutation('requestFleetDeviceDiagnosticRead')
  requestDiagnostic(
    @Args() args: MutationRequestFleetDeviceDiagnosticReadArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestDiagnostic(context, args.input);
  }

  @Query('fleetDeviceDiagnosticOperations')
  diagnosticHistory(
    @Args() args: QueryFleetDeviceDiagnosticOperationsArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.diagnosticHistory(context, args.karmaCarId, args.expectedKarmaDeviceId);
  }

  @Query('fleetDeviceOperationsEnabled')
  enabled(@Context() context: RequestContext) {
    return this.operations.enabled(context);
  }

  @Query('fleetDeviceConfigurationWritesEnabled')
  writesEnabled(@Context() context: RequestContext) {
    return this.operations.writesEnabled(context);
  }

  @Query('fleetDeviceParameterPresets')
  presets(@Context() context: RequestContext) {
    return this.operations.presets(context);
  }

  @Mutation('requestFleetDeviceParameterAddition')
  requestAddition(
    @Args() args: MutationRequestFleetDeviceParameterAdditionArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestAddition(context, args.input);
  }

  @Mutation('requestFleetDeviceParameterIntervalUpdate')
  requestIntervalUpdate(
    @Args() args: MutationRequestFleetDeviceParameterIntervalUpdateArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestIntervalUpdate(context, args.input);
  }

  @Query('fleetDeviceOperation')
  find(@Args() args: QueryFleetDeviceOperationArgs, @Context() context: RequestContext) {
    return this.operations.find(context, args.id);
  }

  @Query('fleetDeviceOperations')
  history(@Args() args: QueryFleetDeviceOperationsArgs, @Context() context: RequestContext) {
    return this.operations.history(context, args.karmaCarId, args.expectedKarmaDeviceId);
  }

  @Query('fleetDeviceConfigurationSnapshot')
  snapshot(
    @Args() args: QueryFleetDeviceConfigurationSnapshotArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.snapshot(context, args.karmaCarId, args.expectedKarmaDeviceId);
  }

  @Mutation('requestFleetDeviceConfigurationRead')
  request(
    @Args() args: MutationRequestFleetDeviceConfigurationReadArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.request(context, args.input);
  }

  @Query('fleetDeviceRulesSnapshot')
  rulesSnapshot(
    @Args() args: QueryFleetDeviceRulesSnapshotArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.rulesSnapshot(context, args.karmaCarId, args.expectedKarmaDeviceId);
  }

  @Mutation('requestFleetDeviceRulesRead')
  requestRules(
    @Args() args: MutationRequestFleetDeviceRulesReadArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestRules(context, args.input);
  }

  @Mutation('requestFleetDeviceRuleChange')
  requestRuleChange(
    @Args() args: MutationRequestFleetDeviceRuleChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.operations.requestRuleChange(context, args.input);
  }
}
