import {
  DEVICE_CONFIGURATION_UNSUPPORTED,
  emptyDeviceParameterSnapshotsPage,
  parseDeviceConfigurationBatchLookup,
  parseDeviceConfigurationHistoryQuery,
  parseDeviceParameterCatalogQuery,
  parseDeviceParameterSnapshotsQuery,
  parseStartDeviceConfigurationBatch,
  parseStartDeviceMeasurementConfigurationChange,
  parseStartDeviceParameterChange,
  parseStartDeviceParameterSnapshot,
  parseStartDeviceParametersChange,
  parseStopDeviceConfigurationBatch,
  DEVICE_SERVER_ROUTES,
} from '@discocan/device-contract';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceConfigurationController {
  @Post(DEVICE_SERVER_ROUTES.startParameterSnapshot)
  @HttpCode(200)
  startParameterSnapshot(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceParameterSnapshot(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.parameterSnapshots)
  @HttpCode(200)
  parameterSnapshots(@Body() body: unknown) {
    return emptyDeviceParameterSnapshotsPage(
      parseRequest(() => parseDeviceParameterSnapshotsQuery(body)),
    );
  }

  @Post(DEVICE_SERVER_ROUTES.parameterCatalog)
  @HttpCode(200)
  parameterCatalog(@Body() body: unknown) {
    const { offset, limit } = parseRequest(() => parseDeviceParameterCatalogQuery(body));
    return { items: [], total: 0, offset, limit };
  }

  @Post(DEVICE_SERVER_ROUTES.configurationChanges)
  @HttpCode(200)
  configurationChanges(@Body() body: unknown) {
    parseRequest(() => parseDeviceConfigurationHistoryQuery(body));
    return [];
  }

  @Post(DEVICE_SERVER_ROUTES.configurationWritesEnabled)
  @HttpCode(200)
  configurationWritesEnabled(@Body() body: unknown) {
    parseRequest(() => parseDeviceConfigurationHistoryQuery(body));
    return false;
  }

  @Post(DEVICE_SERVER_ROUTES.startMeasurementConfigurationChange)
  @HttpCode(200)
  startMeasurementConfigurationChange(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceMeasurementConfigurationChange(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.startParameterChange)
  @HttpCode(200)
  startParameterChange(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceParameterChange(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.startParametersChange)
  @HttpCode(200)
  startParametersChange(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceParametersChange(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.startConfigurationBatch)
  @HttpCode(200)
  startConfigurationBatch(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceConfigurationBatch(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.getConfigurationBatch)
  @HttpCode(200)
  getConfigurationBatch(@Body() body: unknown) {
    parseRequest(() => parseDeviceConfigurationBatchLookup(body));
    return { item: null };
  }

  @Post(DEVICE_SERVER_ROUTES.stopConfigurationBatch)
  @HttpCode(200)
  stopConfigurationBatch(@Body() body: unknown) {
    parseRequest(() => parseStopDeviceConfigurationBatch(body));
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }
}
