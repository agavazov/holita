import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { DevicesRepository } from '../src/modules/devices/devices.repository.js';
import { DriversRepository } from '../src/modules/drivers/drivers.repository.js';
import { VehicleGroupsRepository } from '../src/modules/vehicle-groups/vehicle-groups.repository.js';
import { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository.js';
import { uniqueViolation } from '../src/validation.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

const tenantId = '01000000-0000-4000-8000-000000000001';

async function rejection(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the database to reject the write');
}

describe('Fleet master data and activity constraints in PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const connection = new pg.Client({ connectionString: getTestDatabaseUrl() });
  let connected = false;
  const branchId = randomUUID(),
    otherBranchId = randomUUID();
  let vehicleId: string;
  let module: TestingModule;
  let nextImei = 900000000000000;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    await connection.connect();
    connected = true;
    await connection.query(`SET search_path TO ${pg.escapeIdentifier(database.schema)}`);
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch: jest.fn<CoreClient['requireBranch']>() })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    vehicleId = (
      await database.client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'BASE' } })
    ).id;
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        if (connected) {
          await connection.end();
        }
      } finally {
        await closeDatabase?.();
      }
    }
  });
  async function query(source: string, variables: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        'x-branch-id': branchId,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function sqlError(statement: string, values: unknown[]) {
    return rejection(connection.query(statement, values));
  }

  it.each([
    ['Vehicle_modelYear_check', 'UPDATE "Vehicle" SET "modelYear" = 1949 WHERE id = $1'],
    ['Vehicle_modelYear_check', 'UPDATE "Vehicle" SET "modelYear" = 2101 WHERE id = $1'],
    ['Vehicle_vin_check', `UPDATE "Vehicle" SET vin = 'WDB9634031L12345O' WHERE id = $1`],
    ['Vehicle_vin_check', `UPDATE "Vehicle" SET vin = 'wdb9634031l123456' WHERE id = $1`],
    [
      'Vehicle_fuelTankCapacityL_check',
      'UPDATE "Vehicle" SET "fuelTankCapacityL" = 0 WHERE id = $1',
    ],
    [
      'Vehicle_fuelTankCapacityL_check',
      'UPDATE "Vehicle" SET "fuelTankCapacityL" = 2001 WHERE id = $1',
    ],
  ])('%s rejects %s', async (constraint, statement) => {
    expect(await sqlError(statement, [vehicleId])).toMatchObject({ code: '23514', constraint });
  });

  it('rejects an INACTIVE vehicle with a current driver', async () => {
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'Check', lastName: 'Driver' },
    });
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'ASSIGNED', currentDriverId: driver.id },
    });
    expect(
      await sqlError(`UPDATE "Vehicle" SET status = 'INACTIVE' WHERE id = $1`, [vehicle.id]),
    ).toMatchObject({ code: '23514', constraint: 'Vehicle_inactive_driver_check' });
  });

  it.each([
    ['Device_options_check', 'UPDATE "Device" SET options = NULL WHERE id = $1'],
    [
      'Device_options_check',
      `UPDATE "Device" SET options = array_fill('CAN'::"FleetDeviceOption", ARRAY[14]) WHERE id = $1`,
    ],
    ['Device_simPhoneNumber_check', `UPDATE "Device" SET "simPhoneNumber" = '12345' WHERE id = $1`],
    [
      'Device_simPhoneNumber_check',
      `UPDATE "Device" SET "simPhoneNumber" = '+359 888' WHERE id = $1`,
    ],
    ['Device_simIccid_check', `UPDATE "Device" SET "simIccid" = '12345678901234567' WHERE id = $1`],
  ])('%s rejects %s', async (constraint, statement) => {
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId, imei: String(nextImei++) },
    });
    expect(device.options).toEqual([]);
    expect(await sqlError(statement, [device.id])).toMatchObject({ code: '23514', constraint });
  });

  it.each([
    [
      'Driver_licenseCategories_check',
      'UPDATE "Driver" SET "licenseCategories" = NULL WHERE id = $1',
    ],
    [
      'Driver_licenseCategories_check',
      `UPDATE "Driver" SET "licenseCategories" = array_fill('C'::"FleetLicenseCategory", ARRAY[11]) WHERE id = $1`,
    ],
    ['Driver_phone_check', `UPDATE "Driver" SET phone = '+359-888-123' WHERE id = $1`],
    ['Driver_phone_check', `UPDATE "Driver" SET phone = '12345' WHERE id = $1`],
  ])('%s rejects %s', async (constraint, statement) => {
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'Check', lastName: 'Driver' },
    });
    expect(driver.licenseCategories).toEqual([]);
    expect(await sqlError(statement, [driver.id])).toMatchObject({ code: '23514', constraint });
  });

  it('rejects group and driver references from another Branch or Tenant with composite keys', async () => {
    const foreignGroup = await database.client.vehicleGroup.create({
      data: { tenantId, branchId: otherBranchId, name: 'Foreign' },
    });
    const foreignDriver = await database.client.driver.create({
      data: { tenantId: randomUUID(), branchId, firstName: 'Foreign', lastName: 'Tenant' },
    });
    expect(
      await rejection(
        database.client.vehicle.create({
          data: { tenantId, branchId, licensePlate: 'X', groupId: foreignGroup.id },
        }),
      ),
    ).toMatchObject({ code: 'P2003' });
    expect(
      await sqlError('UPDATE "Vehicle" SET "currentDriverId" = $2 WHERE id = $1', [
        vehicleId,
        foreignDriver.id,
      ]),
    ).toMatchObject({
      code: '23503',
      constraint: 'Vehicle_tenantId_branchId_currentDriverId_fkey',
    });
    expect(
      await sqlError('UPDATE "Vehicle" SET "groupId" = $2 WHERE id = $1', [
        vehicleId,
        foreignGroup.id,
      ]),
    ).toMatchObject({ code: '23503', constraint: 'Vehicle_tenantId_branchId_groupId_fkey' });
    const ownGroup = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Own' },
    });
    await database.client.vehicle.update({
      where: { id: vehicleId },
      data: { groupId: ownGroup.id },
    });
    expect(
      await rejection(database.client.vehicleGroup.delete({ where: { id: ownGroup.id } })),
    ).toMatchObject({ code: 'P2003' });
    await database.client.vehicle.update({ where: { id: vehicleId }, data: { groupId: null } });
  });

  it('reports the generated unique index names through the pg adapter and maps them in services', async () => {
    const vin = 'WDB9634031L123456';
    await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'U1', fleetNumber: 'U-01', vin },
    });
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId, imei: '123456789012345' },
    });
    await database.client.driver.create({
      data: {
        tenantId,
        branchId,
        firstName: 'U',
        lastName: 'One',
        employeeNumber: 'E-01',
        identificationKey: 'K-01',
      },
    });
    await database.client.vehicleGroup.create({ data: { tenantId, branchId, name: 'Unique' } });
    const cases: [string, Promise<unknown>][] = [
      [
        'Vehicle_tenantId_branchId_fleetNumber_key',
        database.client.vehicle.create({
          data: { tenantId, branchId, licensePlate: 'U2', fleetNumber: 'U-01' },
        }),
      ],
      [
        'Vehicle_tenantId_branchId_vin_key',
        database.client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'U3', vin } }),
      ],
      [
        'Device_tenantId_branchId_imei_key',
        database.client.device.create({
          data: { tenantId, branchId, vehicleId, imei: '123456789012345' },
        }),
      ],
      [
        'Driver_tenantId_branchId_employeeNumber_key',
        database.client.driver.create({
          data: { tenantId, branchId, firstName: 'U', lastName: 'Two', employeeNumber: 'E-01' },
        }),
      ],
      [
        'Driver_tenantId_branchId_identificationKey_key',
        database.client.driver.create({
          data: {
            tenantId,
            branchId,
            firstName: 'U',
            lastName: 'Three',
            identificationKey: 'K-01',
          },
        }),
      ],
      [
        'VehicleGroup_tenantId_branchId_name_key',
        database.client.vehicleGroup.create({ data: { tenantId, branchId, name: 'Unique' } }),
      ],
    ];
    for (const [index, write] of cases) {
      expect(uniqueViolation(await rejection(write))).toEqual({ index, fields: [] });
    }

    // Bypass each service's scoped pre-check so the real insert raises P2002 (a concurrent write).
    jest
      .spyOn(module.get(VehiclesRepository), 'duplicates')
      .mockResolvedValue({ fleetNumber: false, vin: false });
    jest.spyOn(module.get(DevicesRepository), 'imeiTaken').mockResolvedValue(false);
    jest
      .spyOn(module.get(DriversRepository), 'duplicates')
      .mockResolvedValue({ employeeNumber: false, identificationKey: false });
    jest.spyOn(module.get(VehicleGroupsRepository), 'nameTaken').mockResolvedValue(false);
    const mapped: [string, string, Record<string, unknown>][] = [
      [
        'fleetNumber',
        'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
        { input: { licensePlate: 'U4', fleetNumber: 'U-01' } },
      ],
      [
        'vin',
        'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
        { input: { licensePlate: 'U5', vin: vin.toLowerCase() } },
      ],
      [
        'imei',
        'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id}}',
        { input: { imei: '123456789012345', vehicleId } },
      ],
      [
        'employeeNumber',
        'mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id}}',
        { input: { firstName: 'U', lastName: 'Four', employeeNumber: 'E-01' } },
      ],
      [
        'identificationKey',
        'mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id}}',
        { input: { firstName: 'U', lastName: 'Five', identificationKey: 'K-01' } },
      ],
      [
        'name',
        'mutation($input:CreateFleetVehicleGroupInput!){createFleetVehicleGroup(input:$input){id}}',
        { input: { name: ' Unique ' } },
      ],
    ];
    for (const [path, source, variables] of mapped) {
      expect(await query(source, variables)).toMatchObject({
        data: null,
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    }
    jest.restoreAllMocks();
  });

  describe('activity tables', () => {
    const occurredAt = new Date('2026-10-18T06:00:00.000Z');
    const imei = '990601000000001';
    // Distinct sample times keep the (vehicle, IMEI, time) key unique across cases.
    let sampleSecond = 0;
    let tripId: string;
    beforeAll(async () => {
      tripId = (
        await database.client.trip.create({
          data: {
            tenantId,
            branchId,
            vehicleId,
            deviceImei: imei,
            source: 'DEMO',
            startedAt: occurredAt,
          },
        })
      ).id;
    });
    async function deviceSample() {
      return database.client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt: new Date(occurredAt.getTime() - ++sampleSecond * 1000),
          receivedAt: occurredAt,
          latitude: 42.7,
          longitude: 23.3,
          speedKph: 50,
          ignition: true,
        },
      });
    }
    async function manualSample() {
      return database.client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          source: 'MANUAL',
          recordedAt: new Date(occurredAt.getTime() - ++sampleSecond * 1000),
          receivedAt: occurredAt,
          odometerKm: 1000,
        },
      });
    }
    async function trip() {
      return database.client.trip.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          source: 'DEMO',
          startedAt: occurredAt,
          endedAt: new Date(occurredAt.getTime() + 3_600_000),
          startOdometerKm: 1000,
          endOdometerKm: 1100,
          startLatitude: 42.7,
          startLongitude: 23.3,
        },
      });
    }
    async function alert() {
      return database.client.fleetEvent.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          source: 'DEMO',
          occurredAt,
          kind: 'SPEEDING',
          severity: 'WARNING',
          intensity: 3,
          alertStatus: 'OPEN',
        },
      });
    }
    async function planned() {
      return database.client.serviceTask.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          serviceType: 'OIL_CHANGE',
          dueOn: new Date('2026-11-01T00:00:00.000Z'),
        },
      });
    }

    it.each([
      [
        'VehicleStatusSample_source_check',
        'UPDATE "VehicleStatusSample" SET "deviceImei" = NULL WHERE id = $1',
      ],
      [
        'VehicleStatusSample_deviceImei_check',
        `UPDATE "VehicleStatusSample" SET "deviceImei" = '99060100000000A' WHERE id = $1`,
      ],
      [
        'VehicleStatusSample_position_check',
        'UPDATE "VehicleStatusSample" SET longitude = NULL WHERE id = $1',
      ],
      [
        'VehicleStatusSample_position_check',
        'UPDATE "VehicleStatusSample" SET latitude = 90.5 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_position_check',
        'UPDATE "VehicleStatusSample" SET longitude = -180.5 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "speedKph" = 401 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "headingDeg" = 360 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        `UPDATE "VehicleStatusSample" SET "fuelLevelPct" = 'NaN' WHERE id = $1`,
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "externalVoltage" = 60.1 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "backupBatteryVoltage" = -0.1 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        `UPDATE "VehicleStatusSample" SET "engineHours" = 'Infinity' WHERE id = $1`,
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "coolantTempC" = -61 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_measure_check',
        'UPDATE "VehicleStatusSample" SET "odometerKm" = 10000000.1 WHERE id = $1',
      ],
    ])('%s rejects a device sample: %s', async (constraint, statement) => {
      const sample = await deviceSample();
      expect(await sqlError(statement, [sample.id])).toMatchObject({ code: '23514', constraint });
    });

    it.each([
      [
        'VehicleStatusSample_source_check',
        `UPDATE "VehicleStatusSample" SET "deviceImei" = '990601000000009' WHERE id = $1`,
      ],
      [
        'VehicleStatusSample_manual_check',
        'UPDATE "VehicleStatusSample" SET "odometerKm" = NULL WHERE id = $1',
      ],
      [
        'VehicleStatusSample_manual_check',
        'UPDATE "VehicleStatusSample" SET "speedKph" = 0 WHERE id = $1',
      ],
      [
        'VehicleStatusSample_manual_check',
        'UPDATE "VehicleStatusSample" SET ignition = false WHERE id = $1',
      ],
    ])('%s rejects a MANUAL reading: %s', async (constraint, statement) => {
      const sample = await manualSample();
      expect(await sqlError(statement, [sample.id])).toMatchObject({ code: '23514', constraint });
    });

    it.each([
      ['Trip_source_check', `UPDATE "Trip" SET source = 'MANUAL' WHERE id = $1`],
      ['Trip_deviceImei_check', `UPDATE "Trip" SET "deviceImei" = '9906010000000' WHERE id = $1`],
      [
        'Trip_period_check',
        `UPDATE "Trip" SET "endedAt" = "startedAt" - interval '1 millisecond' WHERE id = $1`,
      ],
      ['Trip_position_check', 'UPDATE "Trip" SET "startLongitude" = NULL WHERE id = $1'],
      ['Trip_position_check', 'UPDATE "Trip" SET "endLatitude" = 10 WHERE id = $1'],
      ['Trip_position_check', 'UPDATE "Trip" SET "startLatitude" = -91 WHERE id = $1'],
      ['Trip_measure_check', 'UPDATE "Trip" SET "endOdometerKm" = 999 WHERE id = $1'],
      ['Trip_measure_check', 'UPDATE "Trip" SET "distanceKm" = 5000.1 WHERE id = $1'],
      ['Trip_measure_check', 'UPDATE "Trip" SET "idleSeconds" = 604801 WHERE id = $1'],
      ['Trip_measure_check', `UPDATE "Trip" SET "maxSpeedKph" = 'NaN' WHERE id = $1`],
      ['Trip_measure_check', 'UPDATE "Trip" SET "fuelUsedL" = -1 WHERE id = $1'],
      ['Trip_measure_check', 'UPDATE "Trip" SET "drivingScore" = 100.1 WHERE id = $1'],
      ['Trip_measure_check', 'UPDATE "Trip" SET "ecoScore" = -0.1 WHERE id = $1'],
    ])('%s rejects %s', async (constraint, statement) => {
      const row = await trip();
      expect(await sqlError(statement, [row.id])).toMatchObject({ code: '23514', constraint });
    });

    it.each([
      ['FleetEvent_source_check', `UPDATE "FleetEvent" SET source = 'MANUAL' WHERE id = $1`],
      [
        'FleetEvent_deviceImei_check',
        `UPDATE "FleetEvent" SET "deviceImei" = 'IMEI' WHERE id = $1`,
      ],
      ['FleetEvent_position_check', 'UPDATE "FleetEvent" SET latitude = 42.7 WHERE id = $1'],
      ['FleetEvent_speed_check', 'UPDATE "FleetEvent" SET "speedKph" = -1 WHERE id = $1'],
      ['FleetEvent_intensity_check', 'UPDATE "FleetEvent" SET intensity = 4 WHERE id = $1'],
      ['FleetEvent_intensity_check', `UPDATE "FleetEvent" SET kind = 'IDLING' WHERE id = $1`],
      [
        'FleetEvent_alert_check',
        `UPDATE "FleetEvent" SET "acknowledgedAt" = "occurredAt" WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_check',
        `UPDATE "FleetEvent" SET "alertStatus" = 'ACKNOWLEDGED' WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_check',
        `UPDATE "FleetEvent" SET "alertStatus" = 'RESOLVED' WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_check',
        `UPDATE "FleetEvent" SET "alertStatus" = NULL, remark = 'x' WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_check',
        `UPDATE "FleetEvent" SET "alertStatus" = NULL, "resolvedAt" = "occurredAt" WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_severity_check',
        `UPDATE "FleetEvent" SET severity = 'INFO' WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_time_check',
        `UPDATE "FleetEvent" SET "alertStatus" = 'ACKNOWLEDGED', "acknowledgedAt" = "occurredAt" - interval '1 second' WHERE id = $1`,
      ],
      [
        'FleetEvent_alert_time_check',
        `UPDATE "FleetEvent" SET "alertStatus" = 'RESOLVED', "acknowledgedAt" = "occurredAt" + interval '2 minutes', "resolvedAt" = "occurredAt" + interval '1 minute' WHERE id = $1`,
      ],
    ])('%s rejects %s', async (constraint, statement) => {
      const row = await alert();
      expect(await sqlError(statement, [row.id])).toMatchObject({ code: '23514', constraint });
    });

    it.each([
      ['ServiceTask_status_check', 'UPDATE "ServiceTask" SET "dueOn" = NULL WHERE id = $1'],
      [
        'ServiceTask_status_check',
        `UPDATE "ServiceTask" SET "completedOn" = '2026-10-18' WHERE id = $1`,
      ],
      ['ServiceTask_status_check', 'UPDATE "ServiceTask" SET "costCents" = 0 WHERE id = $1'],
      [
        'ServiceTask_status_check',
        `UPDATE "ServiceTask" SET "replacedParts" = 'Filter' WHERE id = $1`,
      ],
      ['ServiceTask_status_check', `UPDATE "ServiceTask" SET status = 'DONE' WHERE id = $1`],
      [
        'ServiceTask_status_check',
        `UPDATE "ServiceTask" SET status = 'CANCELLED', "completedOdometerKm" = 1 WHERE id = $1`,
      ],
      [
        'ServiceTask_measure_check',
        'UPDATE "ServiceTask" SET "dueOdometerKm" = 10000001 WHERE id = $1',
      ],
      [
        'ServiceTask_measure_check',
        `UPDATE "ServiceTask" SET status = 'DONE', "completedOn" = '2026-10-18', "costCents" = 100000001 WHERE id = $1`,
      ],
    ])('%s rejects %s', async (constraint, statement) => {
      const row = await planned();
      expect(await sqlError(statement, [row.id])).toMatchObject({ code: '23514', constraint });
    });

    it('accepts valid MANUAL readings, cleared alerts, completed and cancelled tasks', async () => {
      const event = await alert();
      await connection.query(
        `UPDATE "FleetEvent" SET "alertStatus" = 'RESOLVED', "resolvedAt" = "occurredAt", remark = 'ok' WHERE id = $1`,
        [event.id],
      );
      await connection.query(
        `UPDATE "FleetEvent" SET "alertStatus" = 'OPEN', "resolvedAt" = NULL WHERE id = $1`,
        [event.id],
      );
      const task = await planned();
      await connection.query(
        `UPDATE "ServiceTask" SET status = 'DONE', "completedOn" = '2026-10-18', "costCents" = 0, "replacedParts" = 'Filter' WHERE id = $1`,
        [task.id],
      );
      const cancelled = await planned();
      await connection.query(`UPDATE "ServiceTask" SET status = 'CANCELLED' WHERE id = $1`, [
        cancelled.id,
      ]);
      await expect(manualSample()).resolves.toMatchObject({ source: 'MANUAL', deviceImei: null });
    });

    it('rejects activity references from another Branch, Tenant or vehicle with composite keys', async () => {
      const otherVehicle = await database.client.vehicle.create({
        data: { tenantId, branchId, licensePlate: 'OTHER' },
      });
      const foreignVehicle = await database.client.vehicle.create({
        data: { tenantId, branchId: otherBranchId, licensePlate: 'FOREIGN' },
      });
      const foreignDriver = await database.client.driver.create({
        data: { tenantId, branchId: otherBranchId, firstName: 'Foreign', lastName: 'Driver' },
      });
      const foreignTrip = await database.client.trip.create({
        data: {
          tenantId,
          branchId: otherBranchId,
          vehicleId: foreignVehicle.id,
          source: 'DEMO',
          startedAt: occurredAt,
        },
      });
      const row = await trip();
      expect(
        await sqlError('UPDATE "Trip" SET "driverId" = $2 WHERE id = $1', [
          row.id,
          foreignDriver.id,
        ]),
      ).toMatchObject({ code: '23503', constraint: 'Trip_tenantId_branchId_driverId_fkey' });
      const event = await alert();
      expect(
        await sqlError('UPDATE "FleetEvent" SET "tripId" = $2 WHERE id = $1', [
          event.id,
          foreignTrip.id,
        ]),
      ).toMatchObject({
        code: '23503',
        constraint: 'FleetEvent_tenantId_branchId_vehicleId_tripId_fkey',
      });
      // The trip exists in the Branch but belongs to another vehicle.
      expect(
        await sqlError('UPDATE "FleetEvent" SET "vehicleId" = $2, "tripId" = $3 WHERE id = $1', [
          event.id,
          otherVehicle.id,
          tripId,
        ]),
      ).toMatchObject({
        code: '23503',
        constraint: 'FleetEvent_tenantId_branchId_vehicleId_tripId_fkey',
      });
      await connection.query('UPDATE "FleetEvent" SET "tripId" = $2 WHERE id = $1', [
        event.id,
        tripId,
      ]);
      expect(
        await sqlError('UPDATE "FleetEvent" SET "driverId" = $2 WHERE id = $1', [
          event.id,
          foreignDriver.id,
        ]),
      ).toMatchObject({ code: '23503', constraint: 'FleetEvent_tenantId_branchId_driverId_fkey' });
      expect(
        await rejection(
          database.client.vehicleStatusSample.create({
            data: {
              tenantId: randomUUID(),
              branchId,
              vehicleId,
              source: 'MANUAL',
              recordedAt: occurredAt,
              receivedAt: occurredAt,
              odometerKm: 1,
            },
          }),
        ),
      ).toMatchObject({ code: 'P2003' });
      expect(
        await rejection(
          database.client.serviceTask.create({
            data: {
              tenantId,
              branchId: otherBranchId,
              vehicleId,
              serviceType: 'TIRES',
              dueOdometerKm: 1,
            },
          }),
        ),
      ).toMatchObject({ code: 'P2003' });
      // History blocks deleting the vehicle and the trip.
      expect(await rejection(database.client.trip.delete({ where: { id: tripId } }))).toMatchObject(
        { code: 'P2003' },
      );
    });

    it('keys device samples by IMEI and time so two devices may report at the same instant', async () => {
      const recordedAt = new Date('2026-10-01T00:00:00.000Z');
      const data = {
        tenantId,
        branchId,
        vehicleId,
        source: 'DEMO' as const,
        recordedAt,
        receivedAt: recordedAt,
      };
      await database.client.vehicleStatusSample.create({ data: { ...data, deviceImei: imei } });
      await database.client.vehicleStatusSample.create({
        data: { ...data, deviceImei: '990601000000002' },
      });
      expect(
        uniqueViolation(
          await rejection(
            database.client.vehicleStatusSample.create({ data: { ...data, deviceImei: imei } }),
          ),
        ),
      ).toEqual({
        index: 'VehicleStatusSample_tenantId_branchId_vehicleId_deviceImei__key',
        fields: [],
      });
    });
  });
});
