import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  FleetDeviceParameterSnapshotsArgs,
  MutationStartDeviceConfigurationBatchArgs,
  MutationStartDeviceMeasurementConfigurationChangeArgs,
  MutationStartDeviceParameterChangeArgs,
  MutationStartDeviceParameterSnapshotArgs,
  MutationStartDeviceParametersChangeArgs,
  MutationStopDeviceConfigurationBatchArgs,
  QueryFleetDeviceConfigurationBatchArgs,
  QueryFleetDeviceParameterCatalogArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { singleDeviceDetail } from '../../graphql/selection.js';
import type { DeviceResult } from '../devices/devices.service.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

@Resolver('FleetDevice')
@UseGuards(FleetEnabledGuard)
export class DeviceConfigurationResolver {
  constructor(private readonly configuration: DeviceConfigurationService) {}

  @Query('fleetDeviceParameterCatalog')
  parameterCatalog(
    @Args() args: QueryFleetDeviceParameterCatalogArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.parameterCatalog(context, args);
  }

  @Query('fleetDeviceConfigurationBatch')
  configurationBatch(
    @Args() args: QueryFleetDeviceConfigurationBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.batch(context, args.id);
  }

  @Mutation('startDeviceParameterSnapshot')
  startParameterSnapshot(
    @Args() args: MutationStartDeviceParameterSnapshotArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.startSnapshot(context, args.input);
  }

  @Mutation('startDeviceMeasurementConfigurationChange')
  startMeasurementChange(
    @Args() args: MutationStartDeviceMeasurementConfigurationChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.startMeasurementChange(context, args.input);
  }

  @Mutation('startDeviceParameterChange')
  startParameterChange(
    @Args() args: MutationStartDeviceParameterChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.startParameterChange(context, args.input);
  }

  @Mutation('startDeviceParametersChange')
  startParametersChange(
    @Args() args: MutationStartDeviceParametersChangeArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.startParametersChange(context, args.input);
  }

  @Mutation('startDeviceConfigurationBatch')
  startConfigurationBatch(
    @Args() args: MutationStartDeviceConfigurationBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.startBatch(context, args.input);
  }

  @Mutation('stopDeviceConfigurationBatch')
  stopConfigurationBatch(
    @Args() args: MutationStopDeviceConfigurationBatchArgs,
    @Context() context: RequestContext,
  ) {
    return this.configuration.stopBatch(context, args.id);
  }

  @ResolveField('parameterSnapshots')
  parameterSnapshots(
    @Parent() device: DeviceResult,
    @Args() args: FleetDeviceParameterSnapshotsArgs,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    singleDeviceDetail(info);
    return this.configuration.parameterSnapshots(context, device, args.input);
  }

  @ResolveField('configurationChanges')
  configurationChanges(
    @Parent() device: DeviceResult,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    singleDeviceDetail(info);
    return this.configuration.configurationChanges(context, device);
  }

  @ResolveField('configurationWritesEnabled')
  configurationWritesEnabled(
    @Parent() device: DeviceResult,
    @Context() context: RequestContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    singleDeviceDetail(info);
    return this.configuration.configurationWritesEnabled(context, device);
  }
}
