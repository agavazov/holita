import {
  parseDeviceConfigurationBatch,
  parseDeviceConfigurationOutcome,
  parseDeviceParameterDefinition,
  parseDeviceParameterDifference,
  parseDeviceSnapshotValue,
  parseDeviceConfigurationBatchLookupResult,
  parseDeviceConfigurationChange,
  parseDeviceConfigurationHistory,
  parseDeviceConfigurationWritesEnabled,
  parseDeviceParameterCatalogPage,
  parseDeviceParameterSnapshot,
  parseDeviceParameterSnapshotsPage,
  type DeviceConfigurationBatchLookup,
  type DeviceConfigurationHistoryQuery,
  type DeviceParameterCatalogQuery,
  type DeviceParameterSnapshotsQuery,
  type StartDeviceConfigurationBatch,
  type StartDeviceMeasurementConfigurationChange,
  type StartDeviceParameterChange,
  type StartDeviceParameterSnapshot,
  type StartDeviceParametersChange,
  type StopDeviceConfigurationBatch,
  DEVICE_SERVER_ROUTES,
} from '@discocan/device-contract';
import type { FleetDeviceConfigurationBatch } from '../../generated/graphql/types.js';
import { requestDeviceServer } from './discocan-api.js';

function parameterSnapshot(value: unknown) {
  return parseDeviceParameterSnapshot(
    value,
    parseDeviceSnapshotValue,
    parseDeviceParameterDifference,
  );
}

function configurationBatch(value: unknown): FleetDeviceConfigurationBatch {
  return {
    ...parseDeviceConfigurationBatch(value, parseDeviceConfigurationChange),
    deviceType: 'DISCOCAN',
  };
}

export const discocanConfiguration = {
  startParameterSnapshot: (body: StartDeviceParameterSnapshot) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.startParameterSnapshot, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, parameterSnapshot),
    });
  },

  parameterSnapshots: (body: DeviceParameterSnapshotsQuery) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.parameterSnapshots, {
      body,
      parse: (value) => parseDeviceParameterSnapshotsPage(value, parameterSnapshot),
    });
  },

  parameterCatalog: (body: DeviceParameterCatalogQuery) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.parameterCatalog, {
      body,
      parse: (value) => parseDeviceParameterCatalogPage(value, parseDeviceParameterDefinition),
    });
  },

  configurationChanges: (body: DeviceConfigurationHistoryQuery) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.configurationChanges, {
      body,
      parse: (value) => parseDeviceConfigurationHistory(value, parseDeviceConfigurationChange),
    });
  },

  configurationWritesEnabled: (body: DeviceConfigurationHistoryQuery) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.configurationWritesEnabled, {
      body,
      parse: parseDeviceConfigurationWritesEnabled,
    });
  },

  startMeasurementConfigurationChange: (body: StartDeviceMeasurementConfigurationChange) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.startMeasurementConfigurationChange, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, parseDeviceConfigurationChange),
    });
  },

  startParameterChange: (body: StartDeviceParameterChange) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.startParameterChange, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, parseDeviceConfigurationChange),
    });
  },

  startParametersChange: (body: StartDeviceParametersChange) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.startParametersChange, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, parseDeviceConfigurationChange),
    });
  },

  startConfigurationBatch: (body: StartDeviceConfigurationBatch) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.startConfigurationBatch, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, configurationBatch),
    });
  },

  getConfigurationBatch: (body: DeviceConfigurationBatchLookup) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.getConfigurationBatch, {
      body,
      parse: (value) => parseDeviceConfigurationBatchLookupResult(value, configurationBatch),
    });
  },

  stopConfigurationBatch: (body: StopDeviceConfigurationBatch) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.stopConfigurationBatch, {
      body,
      parse: (value) => parseDeviceConfigurationOutcome(value, configurationBatch),
    });
  },
};
