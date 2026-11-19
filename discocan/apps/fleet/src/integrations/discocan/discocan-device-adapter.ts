import { Injectable } from '@nestjs/common';
import type { DeviceAdapter } from '../device-adapter.js';
import { discocanInspection } from './discocan-inspection.js';
import { discocanCommands } from './discocan-commands.js';
import { discocanConfiguration } from './discocan-configuration.js';
import { discocanReports } from './discocan-reports.js';
import { discocanStatus } from './discocan-status.js';
import { discocanNotifications } from './discocan-notifications.js';

@Injectable()
export class DiscocanDeviceAdapter implements DeviceAdapter {
  readonly states = discocanInspection.states;
  readonly events = discocanInspection.events;
  readonly messages = discocanInspection.messages;

  readonly createCommand = discocanCommands.createCommand;
  readonly listCommands = discocanCommands.listCommands;
  readonly getCommand = discocanCommands.getCommand;
  readonly cancelCommand = discocanCommands.cancelCommand;
  readonly retryCommand = discocanCommands.retryCommand;
  readonly startCommandBatch = discocanCommands.startCommandBatch;
  readonly getCommandBatch = discocanCommands.getCommandBatch;
  readonly stopCommandBatch = discocanCommands.stopCommandBatch;
  readonly commandRequestHistory = discocanCommands.commandRequestHistory;
  readonly commandHistory = discocanCommands.commandHistory;
  readonly actionCatalog = discocanCommands.actionCatalog;
  readonly requestFaultRead = discocanCommands.requestFaultRead;
  readonly answeredFaultReads = discocanCommands.answeredFaultReads;

  readonly startParameterSnapshot = discocanConfiguration.startParameterSnapshot;
  readonly parameterSnapshots = discocanConfiguration.parameterSnapshots;
  readonly parameterCatalog = discocanConfiguration.parameterCatalog;
  readonly configurationChanges = discocanConfiguration.configurationChanges;
  readonly configurationWritesEnabled = discocanConfiguration.configurationWritesEnabled;
  readonly startMeasurementConfigurationChange =
    discocanConfiguration.startMeasurementConfigurationChange;
  readonly startParameterChange = discocanConfiguration.startParameterChange;
  readonly startParametersChange = discocanConfiguration.startParametersChange;
  readonly startConfigurationBatch = discocanConfiguration.startConfigurationBatch;
  readonly getConfigurationBatch = discocanConfiguration.getConfigurationBatch;
  readonly stopConfigurationBatch = discocanConfiguration.stopConfigurationBatch;

  readonly reports = discocanReports.reports;

  readonly liveStates = discocanStatus.liveStates;
  readonly problems = discocanStatus.problems;

  readonly notifications = discocanNotifications.notifications;
}
