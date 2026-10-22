import { convertToParamMap } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { FilterCondition } from '../../ui/filter-builder/filter-model';
import { uiMessages } from '../../ui/i18n/messages';
import type { ListQuery } from '../../ui/list/list-query';
import {
  listStateParams,
  readListState,
  type ListDefinition,
  type ListState,
} from '../../ui/list/list-state';
import { alertRemarkError } from './alerts/alert-mapping';
import { alertDefinition, alertQueryState, alertVariables } from './alerts/alert-query';
import { deviceConfigurationText } from './device-operations/i18n/messages';
import { deviceFieldErrors } from './devices/device-mapping';
import { deviceDefinition, deviceQueryState, deviceVariables } from './devices/device-query';
import { devicesText } from './devices/i18n/messages';
import { driverFieldErrors } from './drivers/driver-mapping';
import { driverDefinition, driverQueryState, driverVariables } from './drivers/driver-query';
import { driversText } from './drivers/i18n/messages';
import { fleetFieldErrors } from './field-errors';
import { fleetValidationText } from './i18n/messages';
import { maintenanceText } from './maintenance/i18n/messages';
import {
  maintenanceDefinition,
  maintenanceQueryState,
  maintenanceVariables,
} from './maintenance/maintenance-query';
import { serviceEuroCents } from './maintenance/service-money';
import {
  serviceCompletionFieldErrors,
  serviceTaskFieldErrors,
} from './maintenance/service-task-mapping';
import { generalSettingsFieldErrors } from './settings/general-settings-mapping';
import { settingsText } from './settings/i18n/messages';
import { tripDefinition, tripQueryState, tripVariables } from './trips/trip-query';
import { vehicleGroupFieldErrors } from './vehicle-groups/vehicle-group-mapping';
import { vehiclesText } from './vehicles/i18n/messages';
import { vehicleFieldErrors } from './vehicles/vehicle-mapping';
import { odometerFieldErrors } from './vehicles/vehicle-profile-mapping';
import { vehicleDefinition, vehicleQueryState, vehicleVariables } from './vehicles/vehicle-query';

interface Row {
  readonly row: string;
  readonly actual: unknown;
  readonly expected: unknown;
}

const groupId = '30000000-0000-4000-8000-000000000001';
const vehicleId = '20000000-0000-4000-8000-000000000001';

function conditionsQuery(...conditions: readonly FilterCondition[]): ListQuery {
  return { search: '', sort: null, page: 1, pageSize: 20, conditions };
}

function urlRoundTrip<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): ListState<F, S> {
  return readListState(convertToParamMap(listStateParams(state, definition)), definition);
}

function failure(...fieldErrors: readonly { path: string; code: string }[]) {
  return new CombinedGraphQLErrors({
    errors: [
      {
        message: 'English compatibility banner.',
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: fieldErrors.map((entry) => ({
            ...entry,
            message: 'The same English compatibility text for every reason.',
          })),
        },
      },
    ],
  });
}

describe('Fleet logic', () => {
  it('maps calendar-date filters to Branch-zone half-open instants or inclusive date bounds across DST', () => {
    const alertsOn = (day: string) =>
      alertQueryState(
        conditionsQuery({ id: 'day', field: 'occurredAt', operator: 'on', values: [day] }),
      );
    const tripsOn = (day: string) =>
      tripQueryState(
        conditionsQuery({ id: 'day', field: 'startedAt', operator: 'on', values: [day] }),
      );
    const rows: readonly Row[] = [
      {
        row: 'Alerts on the 23-hour Sofia spring day',
        actual: alertVariables(alertsOn('2026-03-29')).filter?.allOf,
        expected: [
          { occurredFrom: '2026-03-28T22:00:00.000Z', occurredTo: '2026-03-29T21:00:00.000Z' },
        ],
      },
      {
        row: 'Alerts on the 25-hour Sofia autumn day',
        actual: alertVariables(alertsOn('2026-10-25')).filter?.allOf,
        expected: [
          { occurredFrom: '2026-10-24T21:00:00.000Z', occurredTo: '2026-10-25T22:00:00.000Z' },
        ],
      },
      {
        row: 'Alerts on the London spring day',
        actual: alertVariables(alertsOn('2026-03-29'), 'Europe/London').filter?.allOf,
        expected: [
          { occurredFrom: '2026-03-29T00:00:00.000Z', occurredTo: '2026-03-29T23:00:00.000Z' },
        ],
      },
      {
        row: 'Trips on the 25-hour Sofia autumn day',
        actual: tripVariables(tripsOn('2026-10-25')).filter?.allOf,
        expected: [
          { startedFrom: '2026-10-24T21:00:00.000Z', startedTo: '2026-10-25T22:00:00.000Z' },
        ],
      },
      {
        row: 'Trips on the 25-hour New York autumn day',
        actual: tripVariables(tripsOn('2026-11-01'), 'America/New_York').filter?.allOf,
        expected: [
          { startedFrom: '2026-11-01T04:00:00.000Z', startedTo: '2026-11-02T05:00:00.000Z' },
        ],
      },
      {
        row: 'Maintenance literal due dates and inclusive completed dates',
        actual: maintenanceVariables(
          maintenanceQueryState(
            conditionsQuery(
              { id: 'a', field: 'dueOn', operator: 'before', values: ['2026-10-25'] },
              { id: 'b', field: 'dueOn', operator: 'after', values: ['2026-10-18'] },
              { id: 'c', field: 'completedOn', operator: 'before', values: ['2026-10-25'] },
              { id: 'd', field: 'completedOn', operator: 'after', values: ['2026-10-18'] },
            ),
          ),
          'en',
        ).filter?.allOf,
        expected: [
          { dueOnBefore: '2026-10-25' },
          { dueOnAfter: '2026-10-18' },
          { completedTo: '2026-10-24' },
          { completedFrom: '2026-10-19' },
        ],
      },
      {
        row: 'Drivers literal licence and tachograph dates',
        actual: driverVariables(
          driverQueryState(
            conditionsQuery(
              { id: '1', field: 'license', operator: 'before', values: ['2026-10-18'] },
              {
                id: '2',
                field: 'tachoCard',
                operator: 'between',
                values: ['2026-01-01', '2026-12-31'],
              },
            ),
          ),
        ).filter?.allOf,
        expected: [
          { licenseExpiresOnBefore: '2026-10-18' },
          { tachographCardExpiresOnFrom: '2026-01-01', tachographCardExpiresOnTo: '2026-12-31' },
        ],
      },
      {
        row: 'Vehicles literal creation dates',
        actual: vehicleVariables(
          vehicleQueryState(
            conditionsQuery({
              id: '2',
              field: 'createdAt',
              operator: 'between',
              values: ['2026-01-01', '2026-01-31'],
            }),
          ),
        ).filter?.allOf,
        expected: [{ createdOnFrom: '2026-01-01', createdOnTo: '2026-01-31' }],
      },
    ];
    for (const { row, actual, expected } of rows) {
      expect(actual, row).toEqual(expected);
    }
  });

  it("maps each Fleet list's URL conditions to its generated filter and sort and round-trips them through the URL", () => {
    const vehicles = vehicleQueryState({
      search: '',
      page: 3,
      pageSize: 50,
      sort: { field: 'odometer', direction: 'desc' },
      conditions: [
        { id: 'make-1', field: 'make', operator: 'contains', values: ['MAN, Volvo'] },
        { id: 'make-2', field: 'make', operator: 'equals', values: ['Volvo'] },
        { id: 'without-group', field: 'group', operator: 'isNoneOf', values: [groupId] },
        { id: '0', field: 'odometer', operator: 'between', values: ['0', '500'] },
        { id: '1', field: 'year', operator: 'gt', values: ['2000'] },
        { id: '3', field: 'activity', operator: 'isNoneOf', values: ['NO_DEVICE'] },
        { id: '4', field: 'group', operator: 'isEmpty', values: [] },
        { id: '5', field: 'fuelType', operator: 'isAnyOf', values: ['CNG', 'ELECTRIC'] },
      ],
    });
    const devices = deviceQueryState({
      search: '',
      page: 8,
      pageSize: 50,
      sort: { field: 'lastSeenAt', direction: 'desc' },
      conditions: [
        { id: 'one', field: 'model', operator: 'isAnyOf', values: ['STARLINK_TRACKER'] },
        { id: 'two', field: 'model', operator: 'isAnyOf', values: ['STARLINK_SCOUT'] },
        { id: 'prefix', field: 'firmware', operator: 'startsWith', values: ['1_%'] },
        { id: 'stock', field: 'installed', operator: 'isFalse', values: [] },
      ],
    });
    const drivers = driverQueryState({
      search: '',
      page: 4,
      pageSize: 50,
      sort: { field: 'score', direction: 'desc' },
      conditions: [
        { id: 'status-1', field: 'status', operator: 'isAnyOf', values: ['ACTIVE'] },
        { id: 'status-2', field: 'status', operator: 'isNoneOf', values: ['ACTIVE'] },
        { id: 'score-1', field: 'score', operator: 'between', values: ['0', '100'] },
        { id: 'empty-1', field: 'score', operator: 'isEmpty', values: [] },
        { id: 'trip-1', field: 'trips', operator: 'gt', values: ['0'] },
        { id: 'has-1', field: 'hasVehicle', operator: 'isFalse', values: [] },
        { id: '3', field: 'licenseCategories', operator: 'isAnyOf', values: ['CE', 'B'] },
      ],
    });
    const maintenance = maintenanceQueryState({
      search: 'Oil Sofia',
      page: 2,
      pageSize: 50,
      sort: { field: 'cost', direction: 'desc' },
      conditions: [
        { id: 'a', field: 'cost', operator: 'gt', values: ['0.29'] },
        { id: 'b', field: 'cost', operator: 'lt', values: ['1000000'] },
        { id: 'c', field: 'status', operator: 'isNoneOf', values: ['CANCELLED'] },
        { id: 'd', field: 'vehicleStatus', operator: 'isAnyOf', values: ['IN_WORKSHOP'] },
        { id: 'e', field: 'serviceType', operator: 'isNoneOf', values: ['OTHER'] },
        { id: 'f', field: 'dueOn', operator: 'isEmpty', values: [] },
        { id: 'g', field: 'cost', operator: 'isEmpty', values: [] },
      ],
    });
    const trips = tripQueryState({
      search: 'Sofia',
      page: 2,
      pageSize: 50,
      sort: { field: 'duration', direction: 'desc' },
      conditions: [
        { id: 'a', field: 'distance', operator: 'gt', values: ['0'] },
        { id: 'b', field: 'distance', operator: 'lt', values: ['5000'] },
        { id: 'c', field: 'driver', operator: 'isEmpty', values: [] },
        { id: 'd', field: 'hasEvents', operator: 'isFalse', values: [] },
        { id: 'e', field: 'score', operator: 'gt', values: ['0'] },
      ],
    });
    const alerts = alertQueryState({
      search: 'fuel',
      page: 3,
      pageSize: 50,
      sort: { field: 'status', direction: 'asc' },
      conditions: [
        { id: 'a', field: 'severity', operator: 'isAnyOf', values: ['WARNING', 'CRITICAL'] },
        { id: 'b', field: 'severity', operator: 'isNoneOf', values: ['WARNING'] },
        { id: 'c', field: 'vehicle', operator: 'isNoneOf', values: [vehicleId] },
      ],
    });
    const defaultAlerts = readListState(convertToParamMap({}), alertDefinition);
    const untitledTasks = maintenanceQueryState(
      conditionsQuery({ id: 'task', field: 'task', operator: 'contains', values: ['масло'] }),
    );
    const rows: readonly Row[] = [
      {
        row: 'Vehicles variables',
        actual: vehicleVariables(vehicles),
        expected: {
          offset: 100,
          limit: 50,
          search: null,
          sort: { field: 'ODOMETER_KM', direction: 'DESC' },
          filter: {
            allOf: [
              { makeContains: 'MAN, Volvo' },
              { makeEquals: 'Volvo' },
              { excludedGroupIds: [groupId] },
              { odometerKmFrom: 0, odometerKmTo: 500 },
              { modelYearAbove: 2000 },
              { excludedActivities: ['NO_DEVICE'] },
              { hasGroup: false },
              { fuelTypes: ['ELECTRIC', 'CNG'] },
            ],
          },
        },
      },
      {
        row: 'Vehicles URL',
        actual: urlRoundTrip(vehicles, vehicleDefinition),
        expected: vehicles,
      },
      {
        row: 'Devices variables',
        actual: deviceVariables(devices),
        expected: {
          offset: 350,
          limit: 50,
          search: null,
          sort: { field: 'LAST_REPORTED_AT', direction: 'DESC' },
          filter: {
            allOf: [
              { models: ['STARLINK_TRACKER'] },
              { models: ['STARLINK_SCOUT'] },
              { firmwareVersionStartsWith: '1_%' },
              { hasVehicle: false },
            ],
          },
        },
      },
      { row: 'Devices URL', actual: urlRoundTrip(devices, deviceDefinition), expected: devices },
      {
        row: 'Drivers variables',
        actual: driverVariables(drivers),
        expected: {
          offset: 150,
          limit: 50,
          search: null,
          sort: { field: 'DRIVING_SCORE_30D', direction: 'DESC' },
          filter: {
            allOf: [
              { statuses: ['ACTIVE'] },
              { excludedStatuses: ['ACTIVE'] },
              { scoreFrom: 0, scoreTo: 100 },
              { hasScore: false },
              { tripCountAbove: 0 },
              { hasVehicle: false },
              { licenseCategories: ['B', 'CE'] },
            ],
          },
        },
      },
      { row: 'Drivers URL', actual: urlRoundTrip(drivers, driverDefinition), expected: drivers },
      {
        row: 'Maintenance variables',
        actual: maintenanceVariables(maintenance, 'en'),
        expected: {
          offset: 50,
          limit: 50,
          search: 'Oil Sofia',
          sort: { field: 'COST_CENTS', direction: 'DESC' },
          filter: {
            allOf: [
              { costCentsAbove: 29 },
              { costCentsBelow: 100_000_000 },
              { excludedStatuses: ['CANCELLED'] },
              { vehicleStatuses: ['IN_WORKSHOP'] },
              { excludedServiceTypes: ['OTHER'] },
              { hasDueOn: false },
              { hasCost: false },
            ],
          },
        },
      },
      {
        row: 'Maintenance URL',
        actual: urlRoundTrip(maintenance, maintenanceDefinition),
        expected: maintenance,
      },
      {
        row: 'Maintenance untitled task in Bulgarian',
        actual: maintenanceVariables(untitledTasks, 'bg').filter,
        expected: { allOf: [{ taskContains: 'масло', untitledServiceTypes: ['OIL_CHANGE'] }] },
      },
      {
        row: 'Maintenance untitled task in English',
        actual: maintenanceVariables(untitledTasks, 'en').filter,
        expected: { allOf: [{ taskContains: 'масло', untitledServiceTypes: [] }] },
      },
      {
        row: 'Trips variables',
        actual: tripVariables(trips),
        expected: {
          offset: 50,
          limit: 50,
          search: 'Sofia',
          sort: { field: 'DURATION_SECONDS', direction: 'DESC' },
          filter: {
            allOf: [
              { distanceKmAbove: 0 },
              { distanceKmBelow: 5000 },
              { hasDriver: false },
              { hasEvents: false },
              { drivingScoreAbove: 0 },
            ],
          },
        },
      },
      { row: 'Trips URL', actual: urlRoundTrip(trips, tripDefinition), expected: trips },
      {
        row: 'Alerts variables',
        actual: alertVariables(alerts),
        expected: {
          offset: 100,
          limit: 50,
          search: 'fuel',
          sort: { field: 'ALERT_STATUS', direction: 'ASC' },
          filter: {
            actionable: true,
            allOf: [
              { severities: ['CRITICAL', 'WARNING'] },
              { excludedSeverities: ['WARNING'] },
              { excludedVehicleIds: [vehicleId] },
            ],
          },
        },
      },
      { row: 'Alerts URL', actual: urlRoundTrip(alerts, alertDefinition), expected: alerts },
      {
        row: 'Alerts default excludes resolved alerts',
        actual: alertVariables(defaultAlerts).filter,
        expected: { actionable: true, allOf: [{ excludedAlertStatuses: ['RESOLVED'] }] },
      },
      {
        row: 'Alerts explicitly cleared filter survives the URL',
        actual: alertVariables(
          urlRoundTrip({ ...defaultAlerts, filter: { conditions: [] } }, alertDefinition),
        ).filter,
        expected: { actionable: true, allOf: [] },
      },
    ];
    for (const { row, actual, expected } of rows) {
      expect(actual, row).toEqual(expected);
    }
  });

  it('converts decimal EUR strings into exact cents without rounding fractional cents', () => {
    const rows: readonly (readonly [string, number | null])[] = [
      ['0', 0],
      ['0.01', 1],
      ['0.29', 29],
      [String(0.29), 29],
      ['999999.19', 99_999_919],
      [String(999_999.19), 99_999_919],
      ['1000000', 100_000_000],
      ['0.001', null],
      ['-1', null],
      ['1000000.01', null],
      ['NaN', null],
      ['1e3', null],
      [String(999_999.191), null],
    ];
    for (const [text, cents] of rows) {
      expect(serviceEuroCents(text), text).toBe(cents);
    }
  });

  it("maps each Fleet editor's server fieldErrors to its own control with the reason-specific message", () => {
    const validation = uiMessages.en.validation;
    const fleet = fleetValidationText('en');
    const completion = maintenanceText('en').completion;
    const rows: readonly Row[] = [
      {
        row: 'vehicle',
        actual: vehicleFieldErrors(
          failure(
            { path: 'currentDriverId', code: 'DRIVER_ASSIGNED' },
            { path: 'vin', code: 'ALREADY_EXISTS' },
            { path: 'plate', code: 'REQUIRED' },
          ),
        ),
        expected: {
          driverId: vehiclesText('en').drawer.inactiveDriver,
          vin: vehiclesText('en').drawer.duplicateVin,
        },
      },
      {
        row: 'vehicle in Bulgarian',
        actual: vehicleFieldErrors(
          failure(
            { path: 'currentDriverId', code: 'DRIVER_UNAVAILABLE' },
            { path: 'licensePlate', code: 'REQUIRED' },
          ),
          'bg',
        ),
        expected: {
          driverId: fleetValidationText('bg').driverUnavailable,
          plate: uiMessages.bg.validation.required,
        },
      },
      {
        row: 'driver',
        actual: driverFieldErrors(
          failure(
            { path: 'employeeNumber', code: 'ALREADY_EXISTS' },
            { path: 'tachographCardExpiresOn', code: 'INVALID_VALUE' },
            { path: 'status', code: 'DRIVER_ASSIGNED' },
            { path: 'employeeNo', code: 'REQUIRED' },
          ),
        ),
        expected: {
          employeeNo: driversText('en').drawer.duplicateEmployeeNo,
          tachoCardExpiresOn: validation.invalid,
          status: driversText('en').drawer.assignedDriver,
        },
      },
      {
        row: 'device',
        actual: deviceFieldErrors(
          failure(
            { path: 'options', code: 'MODEL_OPTIONS_UNSUPPORTED' },
            { path: 'imei', code: 'ALREADY_EXISTS' },
            { path: 'unknown', code: 'REQUIRED' },
          ),
        ),
        expected: {
          options: fleet.modelOptionsUnsupported,
          imei: devicesText('en').drawer.duplicateImei,
        },
      },
      {
        row: 'vehicle group',
        actual: vehicleGroupFieldErrors(
          failure(
            { path: 'name', code: 'ALREADY_EXISTS' },
            { path: 'colorToken', code: 'INVALID_VALUE' },
          ),
        ),
        expected: {
          name: settingsText('en').groups.drawer.duplicateName,
          slot: validation.invalid,
        },
      },
      {
        row: 'service task',
        actual: serviceTaskFieldErrors(
          failure(
            { path: 'dueOn', code: 'DUE_THRESHOLD_REQUIRED' },
            { path: 'dueOdometerKm', code: 'OUT_OF_RANGE' },
            { path: 'nextDueOn', code: 'VEHICLE_UNAVAILABLE' },
          ),
        ),
        expected: { dueOn: fleet.dueThresholdRequired, dueKm: validation.outOfRange },
      },
      {
        row: 'service completion',
        actual: serviceCompletionFieldErrors(
          failure(
            { path: 'completedOdometerKm', code: 'ODOMETER_DECREASE' },
            { path: 'nextDueOn', code: 'VEHICLE_UNAVAILABLE' },
            { path: 'dueOdometerKm', code: 'OUT_OF_RANGE' },
          ),
        ),
        expected: {
          completedOdometerKm: completion.earlierOdometerError,
          nextDueOn: completion.inactiveNext,
        },
      },
      {
        row: 'service completion next due',
        actual: serviceCompletionFieldErrors(
          failure(
            { path: 'nextDueOn', code: 'NEXT_DUE_NOT_LATER' },
            { path: 'nextDueOdometerKm', code: 'NEXT_DUE_NOT_LATER' },
          ),
        ),
        expected: {
          nextDueOn: completion.nextDateError,
          nextDueOdometerKm: completion.nextOdometerError,
        },
      },
      {
        row: 'general settings',
        actual: generalSettingsFieldErrors(
          failure(
            { path: 'name', code: 'TOO_LONG' },
            { path: 'lowFuelPct', code: 'OUT_OF_RANGE' },
            { path: 'criticalAlerts', code: 'REQUIRED' },
          ),
        ),
        expected: { name: validation.tooLong, lowFuelPct: validation.outOfRange },
      },
      {
        row: 'odometer',
        actual: odometerFieldErrors(
          failure(
            { path: 'odometerKm', code: 'ODOMETER_DECREASE' },
            { path: 'recordedAt', code: 'READING_AFTER_LATEST_DATA' },
          ),
        ),
        expected: {
          odometerKm: vehiclesText('en').odometer.lowerReading,
          recordedAt: vehiclesText('en').odometer.futureReading,
        },
      },
      {
        row: 'alert remark',
        actual: alertRemarkError(
          failure(
            { path: 'expectedStatus', code: 'INVALID_TRANSITION' },
            { path: 'remark', code: 'TOO_LONG' },
          ),
        ),
        expected: validation.tooLong,
      },
      {
        row: 'alert status conflict',
        actual: alertRemarkError(failure({ path: 'expectedStatus', code: 'INVALID_TRANSITION' })),
        expected: null,
      },
      {
        row: 'device-configuration write',
        actual: fleetFieldErrors(
          failure(
            { path: 'parameterId', code: 'CONFIGURATION_CAPACITY' },
            { path: 'intervalSeconds', code: 'VALUE_UNCHANGED' },
          ),
          ['catalogId', 'parameterId', 'intervalSeconds'],
        ),
        expected: {
          parameterId: fleet.configurationCapacity,
          intervalSeconds: deviceConfigurationText('en').editor.unchanged,
        },
      },
    ];
    for (const { row, actual, expected } of rows) {
      expect(actual, row).toEqual(expected);
    }
  });
});
