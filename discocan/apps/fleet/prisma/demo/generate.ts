import type { Prisma } from '../../src/generated/prisma/client.js';
import type {
  FleetDeviceOption,
  FleetEventKind,
  FleetServiceType,
} from '../../src/generated/prisma/enums.js';
import {
  DEMO_SCOPE,
  carModels,
  driverNumber,
  firstNames,
  idleVehicles,
  inactiveVehicles,
  lastNames,
  movingVehicles,
  places,
  rigidModels,
  tractorModels,
  trailerModels,
  vanModels,
  withoutDevice,
  workshopVehicles,
} from './catalog.js';
import { DEMO_CLOCK_SAMPLE_ID, demoId, masterId } from './ids.js';
import { randomInt, rng } from './random.js';
import { DAY_MS, HOUR_MS, addDays, isoWeekday, sofiaDate, sofiaInstant } from './time.js';

export interface FleetDemoDataset {
  groups: (Prisma.VehicleGroupCreateManyInput & { id: string })[];
  drivers: (Prisma.DriverCreateManyInput & { id: string })[];
  vehicles: (Prisma.VehicleCreateManyInput & { id: string })[];
  devices: (Prisma.DeviceCreateManyInput & { id: string })[];
  serviceTasks: (Prisma.ServiceTaskCreateManyInput & { id: string })[];
  trips: (Prisma.TripCreateManyInput & { id: string })[];
  samples: (Prisma.VehicleStatusSampleCreateManyInput & { id: string })[];
  events: (Prisma.FleetEventCreateManyInput & { id: string })[];
}
interface DemoVehicle {
  number: number;
  row: FleetDemoDataset['vehicles'][number];
  primary: FleetDemoDataset['devices'][number] | null;
  baseOdometerKm: number;
  safety: boolean;
  can: boolean;
  latestAt: Date;
}
type DemoTrip = FleetDemoDataset['trips'][number];

function item<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) {
    throw new Error('Missing Fleet demo catalog entry.');
  }
  return value;
}
const dateValue = (value: Date | string): Date =>
  typeof value === 'string' ? new Date(value) : value;
const numberLabel = (value: number): string => String(value).padStart(2, '0');
const rounded = (value: number): number => Math.round(value * 1000) / 1000;

function masterData(data: FleetDemoDataset, anchor: Date): DemoVehicle[] {
  const date = sofiaDate(anchor);
  const groupNames = ['Международни', 'Вътрешни', 'Градска доставка', 'Ремаркета', 'Нова група'];
  const colors = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
  for (let number = 1; number <= 5; number++) {
    data.groups.push({
      id: masterId('group', number),
      ...DEMO_SCOPE,
      name: item(groupNames, number - 1),
      description: 'Synthetic Fleet demo group; no real organizational data.',
      colorToken: item(colors, number - 1),
      createdAt: anchor,
      updatedAt: anchor,
    });
  }
  for (let number = 1; number <= 36; number++) {
    const next = rng(`driver:${String(number)}`);
    const licenseOffset =
      number === 7 ? -20 : number === 9 ? 5 : number === 18 ? 21 : randomInt(next, 365, 2920);
    const cardOffset =
      number === 15 ? -3 : number === 11 ? 12 : number === 25 ? 29 : randomInt(next, 100, 1700);
    data.drivers.push({
      id: masterId('driver', number),
      ...DEMO_SCOPE,
      firstName: item(firstNames, number - 1),
      lastName: item(lastNames, number - 1),
      employeeNumber: number >= 31 && number <= 35 ? null : `E-01${numberLabel(number)}`,
      identificationKey: number <= 24 ? `iB-DEMO-${numberLabel(number)}` : null,
      phone: number === 35 ? null : `+359 88 800 00${numberLabel(number)}`,
      email: number === 35 ? null : `driver.${numberLabel(number)}@example.com`,
      status: number >= 34 ? 'INACTIVE' : number >= 26 && number <= 28 ? 'ON_LEAVE' : 'ACTIVE',
      licenseNumber: number === 35 ? null : `DEMO-L-${numberLabel(number)}`,
      licenseCategories: number <= 18 ? ['C', 'CE'] : number <= 21 ? ['C'] : ['B'],
      licenseExpiresOn:
        number === 35 ? null : new Date(`${addDays(date, licenseOffset)}T00:00:00Z`),
      tachographCardNumber: number === 35 ? null : `BGDEMO${numberLabel(number)}`,
      tachographCardExpiresOn:
        number === 35 ? null : new Date(`${addDays(date, cardOffset)}T00:00:00Z`),
      notes: 'Synthetic demonstration person; not an employee record.',
      createdAt: anchor,
      updatedAt: anchor,
    });
  }
  const vehicles: DemoVehicle[] = [];
  for (let number = 1; number <= 46; number++) {
    const next = rng(`vehicle:${String(number)}`);
    const models: readonly (readonly [string, string])[] =
      number <= 20
        ? tractorModels
        : number <= 26
          ? rigidModels
          : number <= 37
            ? vanModels
            : number <= 42
              ? carModels
              : trailerModels;
    const model = item(models, number - 1);
    const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    const vin =
      'WDB' +
      Array.from(
        { length: 10 },
        () => alphabet[randomInt(next, 0, alphabet.length - 1)] ?? 'X',
      ).join('') +
      String(number).padStart(4, '0');
    const currentDriver = driverNumber(number);
    const row: FleetDemoDataset['vehicles'][number] = {
      id: masterId('vehicle', number),
      ...DEMO_SCOPE,
      licensePlate:
        number === 38 || number === 42
          ? 'CB 4410 PK'
          : number === 39
            ? 'СА 7712 КН'
            : number === 41
              ? 'CA7712KH'
              : number === 40
                ? 'CB 1040 AX · ТЕСТОВ ДЪЛЪГ НОМЕРА'.padEnd(32, 'X').slice(0, 32)
                : `CB 10${numberLabel(number)} AX`,
      fleetNumber: `${number <= 20 ? 'Т' : number <= 26 ? 'К' : number <= 37 ? 'Б' : number <= 42 ? 'Л' : 'Р'}-${numberLabel(number <= 20 ? number : number <= 26 ? number - 20 : number <= 37 ? number - 26 : number <= 42 ? number - 37 : number - 42)}`,
      vehicleType:
        number <= 20
          ? 'TRACTOR'
          : number <= 26
            ? 'RIGID_TRUCK'
            : number <= 37
              ? 'VAN'
              : number <= 42
                ? 'CAR'
                : 'TRAILER',
      make: model[0],
      model: model[1],
      modelYear: randomInt(next, 2016, 2025),
      vin: [19, 40, 41, 43, 46].includes(number) ? null : vin,
      fuelType:
        number >= 43
          ? null
          : number === 37
            ? 'ELECTRIC'
            : number === 39
              ? 'HYBRID'
              : number === 40
                ? 'LPG'
                : number >= 38
                  ? 'PETROL'
                  : 'DIESEL',
      fuelTankCapacityL:
        number >= 43 || number === 37
          ? null
          : number <= 20
            ? 600 + randomInt(next, 0, 6) * 100
            : number <= 26
              ? randomInt(next, 2, 3) * 100
              : 80,
      status: inactiveVehicles.includes(number)
        ? 'INACTIVE'
        : workshopVehicles.includes(number)
          ? 'IN_WORKSHOP'
          : 'ACTIVE',
      groupId:
        number >= 38 && number <= 41
          ? null
          : masterId(
              'group',
              number <= 12 ? 1 : number <= 26 || number === 42 ? 2 : number <= 37 ? 3 : 4,
            ),
      currentDriverId: currentDriver === null ? null : masterId('driver', currentDriver),
      notes:
        number === 33
          ? Array.from('Демонстрационна бележка 🚚\n'.repeat(100)).slice(0, 2000).join('')
          : number === 32
            ? '100% _test_ C:\\депо'
            : 'Synthetic Fleet demo vehicle; no real registration or VIN.',
      createdAt: anchor,
      updatedAt: anchor,
    };
    data.vehicles.push(row);
    const scout = (number >= 27 && number <= 37) || number >= 43;
    const safety = !withoutDevice.includes(number) && ![25, 35, 39].includes(number) && number < 43;
    const can = number <= 26 && !withoutDevice.includes(number);
    let primary: FleetDemoDataset['devices'][number] | null = null;
    if (!withoutDevice.includes(number)) {
      const ordinal = data.devices.length + 1;
      const options: FleetDeviceOption[] = ['CELLULAR_4G'];
      if (safety) {
        options.push('SAFETY_SF');
      }
      if (can) {
        options.push('CAN', 'DRIVER_ID');
      }
      if (number >= 43) {
        options.push('GEOZONES_GO', 'TEMPERATURE_DS');
      }
      primary = {
        id: masterId('device', ordinal),
        ...DEMO_SCOPE,
        vehicleId: row.id,
        imei: [2, 13, 21, 43].includes(number)
          ? `0099060100${String(ordinal).padStart(5, '0')}`
          : `990601${String(ordinal).padStart(9, '0')}`,
        model: scout ? 'STARLINK_SCOUT' : 'STARLINK_TRACKER',
        options,
        firmwareVersion: [38, 45, 46].includes(number)
          ? null
          : (number >= 6 && number <= 10) || (number >= 31 && number <= 35)
            ? '5.11.0'
            : '5.12.3',
        simPhoneNumber: `+35989900${String(ordinal).padStart(4, '0')}`,
        simIccid: `893599900000000${String(ordinal).padStart(4, '0')}`,
        installedAt: new Date(anchor.getTime() - randomInt(next, 60, 900) * DAY_MS),
        notes: 'Synthetic StarLink device; not a real IMEI or SIM.',
        createdAt: anchor,
        updatedAt: anchor,
      };
      data.devices.push(primary);
    }
    const ageHours =
      number === 20
        ? 21 * 24
        : number === 37
          ? 9 * 24
          : number === 39
            ? 76
            : number === 44
              ? 140
              : null;
    const minutes =
      number === 2
        ? 0
        : number === 10
          ? 3
          : number === 16
            ? 41
            : number === 23
              ? 17
              : (number % 50) + 1;
    vehicles.push({
      number,
      row,
      primary,
      safety,
      can,
      baseOdometerKm:
        number >= 43 ? 0 : number <= 20 ? 180_000 + number * 13_000 : 40_000 + number * 1000,
      latestAt: new Date(
        anchor.getTime() - (ageHours === null ? minutes * 60_000 : ageHours * HOUR_MS),
      ),
    });
  }
  for (let ordinal = 43; ordinal <= 48; ordinal++) {
    data.devices.push({
      id: masterId('device', ordinal),
      ...DEMO_SCOPE,
      vehicleId:
        ordinal === 43 ? masterId('vehicle', 1) : ordinal === 44 ? masterId('vehicle', 27) : null,
      imei: `990601${String(ordinal).padStart(9, '0')}`,
      model: ordinal % 2 ? 'STARLINK_TRACKER' : 'STARLINK_SCOUT',
      options:
        ordinal === 43
          ? ['CELLULAR_4G', 'CAN']
          : ordinal === 44
            ? ['CELLULAR_4G', 'TEMPERATURE_DS']
            : [],
      firmwareVersion: null,
      simPhoneNumber: null,
      simIccid: null,
      installedAt: ordinal >= 45 ? null : new Date(anchor.getTime() - 2 * DAY_MS),
      notes:
        ordinal >= 45
          ? 'Synthetic unassigned stock device; safe to demonstrate assignment.'
          : 'Synthetic secondary device.',
      createdAt: anchor,
      updatedAt: anchor,
    });
  }
  return vehicles;
}

function createTrips(data: FleetDemoDataset, vehicles: readonly DemoVehicle[], anchor: Date): void {
  const anchorDate = sofiaDate(anchor);
  for (const vehicle of vehicles) {
    if (vehicle.number >= 43 || [19, 36, 41].includes(vehicle.number)) {
      continue;
    }
    let odometer = vehicle.baseOdometerKm;
    for (let day = -30; day <= 0; day++) {
      const date = addDays(anchorDate, day);
      const weekday = isoWeekday(date);
      const van = vehicle.row.vehicleType === 'VAN';
      let count =
        weekday <= 5
          ? vehicle.number <= 20
            ? 2
            : vehicle.number <= 26
              ? 3
              : van
                ? 4
                : 2
          : weekday === 6 && van
            ? 2
            : 0;
      if (vehicle.number === 40 && [-5, -4, -3].includes(day)) {
        count = Math.max(count, 1);
      }
      if ((vehicle.number === 6 && day === -15) || (vehicle.number === 2 && day === -8)) {
        count = 1;
      }
      const next = rng(`trips:V${numberLabel(vehicle.number)}:${date}`);
      for (let ordinal = 1; ordinal <= count; ordinal++) {
        const overnight = vehicle.number === 2 && day === -8;
        const yardMove = vehicle.number === 5 && day === -3 && ordinal === 1;
        const startedAt = sofiaInstant(
          date,
          overnight
            ? 21 * 60 + 10
            : (van ? 450 : 330) + (ordinal - 1) * (vehicle.number <= 20 ? 330 : 130),
        );
        const distanceKm = yardMove
          ? 0
          : vehicle.number === 6 && day === -15
            ? 1120
            : overnight
              ? 350
              : vehicle.number <= 20
                ? randomInt(next, 120, 380)
                : vehicle.number <= 26
                  ? randomInt(next, 25, 90)
                  : van
                    ? randomInt(next, 5, 35)
                    : randomInt(next, 10, 60);
        const endedAt = new Date(
          startedAt.getTime() +
            (yardMove
              ? 4 * 60_000
              : overnight
                ? 7.5 * HOUR_MS
                : Math.ceil((distanceKm / (van ? 35 : 70)) * HOUR_MS)),
        );
        const stopAt = workshopVehicles.includes(vehicle.number)
          ? anchor.getTime() - 2 * DAY_MS
          : vehicle.latestAt.getTime();
        if (endedAt.getTime() > stopAt) {
          continue;
        }
        let driver = driverNumber(vehicle.number);
        if ([32, 34, 37].includes(vehicle.number) && day < -15) {
          driver = vehicle.number === 32 ? 34 : vehicle.number === 34 ? 35 : 36;
        }
        if (next() < 0.04) {
          driver = null;
        }
        if (vehicle.number === 40 && ordinal === 1 && [-5, -4, -3].includes(day)) {
          driver = 33;
        }
        const risky = driver !== null && [3, 11, 22].includes(driver);
        const start = item(places, vehicle.number + ordinal);
        const end = item(places, vehicle.number + ordinal + 1);
        const missingEnd =
          (vehicle.number === 31 && day === -12 && ordinal === 1) ||
          (vehicle.number === 14 && day === -20 && ordinal === 1);
        data.trips.push({
          id: demoId('trip', `V${numberLabel(vehicle.number)}:${date}:${String(ordinal)}`),
          ...DEMO_SCOPE,
          vehicleId: vehicle.row.id,
          driverId: driver === null ? null : masterId('driver', driver),
          deviceImei: vehicle.primary?.imei ?? null,
          source: 'DEMO',
          startedAt,
          endedAt: missingEnd ? null : endedAt,
          startAddress: start.address,
          endAddress: missingEnd ? null : end.address,
          startLatitude: start.latitude,
          startLongitude: start.longitude,
          endLatitude: missingEnd ? null : end.latitude,
          endLongitude: missingEnd ? null : end.longitude,
          startOdometerKm: odometer,
          endOdometerKm: missingEnd ? null : rounded(odometer + distanceKm),
          distanceKm: missingEnd ? null : distanceKm,
          idleSeconds: randomInt(next, 0, 1800),
          maxSpeedKph:
            vehicle.number === 9 && day === -4 && ordinal === 1 ? 118 : randomInt(next, 65, 95),
          fuelUsedL: vehicle.can
            ? rounded(distanceKm * (vehicle.number <= 20 ? 0.31 : 0.21))
            : null,
          drivingScore: vehicle.safety ? randomInt(next, risky ? 45 : 55, risky ? 78 : 98) : null,
          ecoScore: vehicle.safety ? randomInt(next, 60, 98) : null,
          createdAt: anchor,
        });
        if (!missingEnd) {
          odometer = rounded(odometer + distanceKm);
        }
      }
    }
    if (movingVehicles.includes(vehicle.number) || idleVehicles.includes(vehicle.number)) {
      data.trips.push({
        id: demoId('trip', `V${numberLabel(vehicle.number)}:live`),
        ...DEMO_SCOPE,
        vehicleId: vehicle.row.id,
        driverId: vehicle.row.currentDriverId ?? null,
        deviceImei: vehicle.primary?.imei ?? null,
        source: 'DEMO',
        startedAt: new Date(anchor.getTime() - 2 * HOUR_MS),
        endedAt: null,
        startAddress: item(places, vehicle.number).address,
        startLatitude: item(places, vehicle.number).latitude,
        startLongitude: item(places, vehicle.number).longitude,
        startOdometerKm: odometer,
        createdAt: anchor,
      });
    }
  }
}

function odometerAt(
  vehicle: DemoVehicle,
  trips: readonly DemoTrip[],
  recordedAt: Date,
): number | null {
  if (vehicle.number >= 43) {
    return null;
  }
  let odometer = vehicle.baseOdometerKm;
  for (const trip of trips) {
    if (trip.endedAt != null && dateValue(trip.endedAt).getTime() <= recordedAt.getTime()) {
      odometer += trip.distanceKm ?? 0;
    } else if (
      trip.endedAt != null &&
      dateValue(trip.startedAt).getTime() <= recordedAt.getTime()
    ) {
      const ratio =
        (recordedAt.getTime() - dateValue(trip.startedAt).getTime()) /
        (dateValue(trip.endedAt).getTime() - dateValue(trip.startedAt).getTime());
      odometer += (trip.distanceKm ?? 0) * ratio;
    }
  }
  return rounded(odometer);
}

function statusSample(
  vehicle: DemoVehicle,
  trips: readonly DemoTrip[],
  anchor: Date,
  recordedAt: Date,
): FleetDemoDataset['samples'][number] {
  const live = recordedAt.getTime() === vehicle.latestAt.getTime();
  const active = trips.find(
    (trip) =>
      trip.endedAt != null &&
      dateValue(trip.startedAt).getTime() <= recordedAt.getTime() &&
      dateValue(trip.endedAt).getTime() > recordedAt.getTime(),
  );
  const moving = live ? movingVehicles.includes(vehicle.number) : active !== undefined;
  const idle = live && idleVehicles.includes(vehicle.number);
  const asset = vehicle.number >= 43;
  const place = item(places, vehicle.number);
  const position =
    vehicle.number === 46 ? null : vehicle.number === 45 ? { latitude: 0, longitude: 0 } : place;
  const start =
    active && active.startLatitude != null && active.startLongitude != null
      ? { latitude: active.startLatitude, longitude: active.startLongitude }
      : position;
  const end =
    active && active.endLatitude != null && active.endLongitude != null
      ? { latitude: active.endLatitude, longitude: active.endLongitude }
      : start;
  const ratio = active?.endedAt
    ? (recordedAt.getTime() - dateValue(active.startedAt).getTime()) /
      (dateValue(active.endedAt).getTime() - dateValue(active.startedAt).getTime())
    : 0;
  const fuel =
    !vehicle.can || (vehicle.number === 3 && recordedAt.getTime() > anchor.getTime() - 3 * HOUR_MS)
      ? null
      : vehicle.number === 20
        ? 0
        : vehicle.number === 10
          ? 9
          : vehicle.number === 16
            ? 8
            : vehicle.number === 23
              ? 11
              : 65;
  return {
    id:
      vehicle.number === 2 && live
        ? DEMO_CLOCK_SAMPLE_ID
        : demoId(
            'sample',
            `${String(vehicle.number)}:${String(vehicle.primary?.imei)}:${recordedAt.toISOString()}`,
          ),
    ...DEMO_SCOPE,
    vehicleId: vehicle.row.id,
    deviceImei: vehicle.primary?.imei ?? null,
    source: 'DEMO',
    recordedAt,
    receivedAt: recordedAt,
    createdAt: anchor,
    latitude:
      start && end ? rounded(start.latitude + (end.latitude - start.latitude) * ratio) : null,
    longitude:
      start && end ? rounded(start.longitude + (end.longitude - start.longitude) * ratio) : null,
    address:
      vehicle.number === 13 && live
        ? "бул. „Христо Ботев“ 1, Пловдив (O'Neill Logistics)"
        : moving
          ? 'Демонстрационен маршрут · АМ „Тракия“'
          : position
            ? place.address
            : null,
    speedKph: asset ? null : moving ? 70 : 0,
    headingDeg: asset ? null : moving ? 90 : 0,
    ignition: asset ? null : moving || idle,
    odometerKm: odometerAt(vehicle, trips, recordedAt),
    fuelLevelPct: fuel,
    externalVoltage:
      vehicle.number === 44 ? 0 : vehicle.number <= 26 ? (moving ? 28 : 25) : moving ? 14.2 : 12.6,
    backupBatteryVoltage: vehicle.number === 44 ? 3.4 : 4.1,
    engineHours: vehicle.number >= 43 ? null : 5000,
    coolantTempC: vehicle.number === 4 && live ? 104 : vehicle.can ? (moving ? 84 : 35) : null,
  };
}

function createSamples(
  data: FleetDemoDataset,
  vehicles: readonly DemoVehicle[],
  anchor: Date,
): void {
  for (const vehicle of vehicles) {
    if (!vehicle.primary) {
      continue;
    }
    const trips = data.trips.filter((trip) => trip.vehicleId === vehicle.row.id);
    const times = new Set<number>([vehicle.latestAt.getTime()]);
    for (
      let time = anchor.getTime() - 15 * DAY_MS;
      time < vehicle.latestAt.getTime() - HOUR_MS;
      time += HOUR_MS
    ) {
      times.add(time);
    }
    // Higher-cadence history covers real trip interpolation without expanding all 31 days.
    for (const trip of trips) {
      if (!trip.endedAt || dateValue(trip.startedAt).getTime() < anchor.getTime() - 7 * DAY_MS) {
        continue;
      }
      const cadence = vehicle.number <= 26 ? 10 * 60_000 : 5 * 60_000;
      for (
        let time = dateValue(trip.startedAt).getTime();
        time <= dateValue(trip.endedAt).getTime() && time < vehicle.latestAt.getTime();
        time += cadence
      ) {
        times.add(time);
      }
    }
    for (const time of [...times].sort((left, right) => left - right)) {
      data.samples.push(statusSample(vehicle, trips, anchor, new Date(time)));
    }
  }
  const van = vehicles.find((vehicle) => vehicle.number === 27);
  const heartbeat = data.devices.find((device) => device.id === masterId('device', 44));
  if (van && heartbeat) {
    const trips = data.trips.filter((trip) => trip.vehicleId === van.row.id);
    for (
      let time = anchor.getTime() - 2 * DAY_MS;
      time <= anchor.getTime() - HOUR_MS;
      time += HOUR_MS
    ) {
      const row = statusSample(van, trips, anchor, new Date(time));
      data.samples.push({
        ...row,
        id: demoId('sample', `27:${heartbeat.imei}:${dateValue(row.recordedAt).toISOString()}`),
        deviceImei: heartbeat.imei,
      });
    }
  }
  const manual = vehicles.find((vehicle) => vehicle.number === 16);
  if (manual) {
    const recordedAt = new Date(anchor.getTime() - 60_000);
    data.samples.push({
      id: demoId('sample', '16:manual-odometer'),
      ...DEMO_SCOPE,
      vehicleId: manual.row.id,
      source: 'MANUAL',
      deviceImei: null,
      recordedAt,
      receivedAt: recordedAt,
      createdAt: anchor,
      odometerKm: odometerAt(
        manual,
        data.trips.filter((trip) => trip.vehicleId === manual.row.id),
        recordedAt,
      ),
    });
  }
}

function alertState(
  occurredAt: Date,
  anchor: Date,
  open: boolean,
): Pick<Prisma.FleetEventCreateManyInput, 'alertStatus' | 'acknowledgedAt' | 'resolvedAt'> {
  if (occurredAt.getTime() > anchor.getTime() - DAY_MS && open) {
    return { alertStatus: 'OPEN', acknowledgedAt: null, resolvedAt: null };
  }
  const acknowledgedAt = new Date(Math.min(anchor.getTime(), occurredAt.getTime() + 15 * 60_000));
  return occurredAt.getTime() > anchor.getTime() - 3 * DAY_MS
    ? { alertStatus: 'ACKNOWLEDGED', acknowledgedAt, resolvedAt: null }
    : {
        alertStatus: 'RESOLVED',
        acknowledgedAt,
        resolvedAt: new Date(occurredAt.getTime() + 3 * HOUR_MS),
      };
}

function createEvents(
  data: FleetDemoDataset,
  vehicles: readonly DemoVehicle[],
  anchor: Date,
): void {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.row.id, vehicle]));
  const openVehicles = new Set<string>();
  const maneuverPool: readonly FleetEventKind[] = [
    'HARSH_BRAKING',
    'HARSH_BRAKING',
    'HARSH_BRAKING',
    'HARSH_ACCELERATION',
    'HARSH_ACCELERATION',
    'SHARP_TURN',
    'SHARP_TURN',
    'LANE_CHANGE',
    'ROUNDABOUT',
    'OVERTAKING',
    'SPEED_BUMP',
    'OFF_ROAD',
  ];
  for (const trip of data.trips) {
    const vehicle = byId.get(trip.vehicleId);
    if (!vehicle) {
      throw new Error('Missing demo trip vehicle.');
    }
    const next = rng(`events:${trip.id}`);
    const start = dateValue(trip.startedAt);
    const end = trip.endedAt ? dateValue(trip.endedAt) : null;
    const base = {
      ...DEMO_SCOPE,
      vehicleId: trip.vehicleId,
      tripId: trip.id,
      driverId: trip.driverId ?? null,
      deviceImei: trip.deviceImei ?? null,
      source: 'DEMO' as const,
      createdAt: anchor,
      updatedAt: anchor,
      latitude: trip.startLatitude ?? null,
      longitude: trip.startLongitude ?? null,
      address: trip.startAddress ?? null,
    };
    data.events.push({
      ...base,
      id: demoId('event', `${trip.id}:ignition-on`),
      occurredAt: start,
      kind: 'IGNITION_ON',
      severity: 'INFO',
    });
    if (end) {
      data.events.push({
        ...base,
        id: demoId('event', `${trip.id}:ignition-off`),
        occurredAt: end,
        kind: 'IGNITION_OFF',
        severity: 'INFO',
      });
    }
    if (!end || !vehicle.safety) {
      continue;
    }
    const risky = [3, 11, 22].some((number) => masterId('driver', number) === trip.driverId);
    const count =
      Math.floor(((trip.distanceKm ?? 0) / 100) * (risky ? 2.4 : 0.6) + next()) +
      (vehicle.number === 8 ? 3 : 0);
    for (let ordinal = 0; ordinal < count; ordinal++) {
      const occurredAt = new Date(
        start.getTime() +
          Math.floor(((end.getTime() - start.getTime()) * (ordinal + 1)) / (count + 1)),
      );
      const intensity = next() < 0.1 ? 3 : next() < 0.33 ? 2 : 1;
      const warning = intensity === 3;
      const allowOpen = !openVehicles.has(vehicle.row.id);
      const state = warning ? alertState(occurredAt, anchor, allowOpen) : {};
      if ('alertStatus' in state && state.alertStatus === 'OPEN') {
        openVehicles.add(vehicle.row.id);
      }
      data.events.push({
        ...base,
        ...state,
        id: demoId('event', `${trip.id}:maneuver:${String(ordinal)}`),
        occurredAt,
        kind: item(maneuverPool, randomInt(next, 0, maneuverPool.length - 1)),
        severity: warning ? 'WARNING' : 'INFO',
        intensity,
        details: 'Synthetic device-reported driving maneuver.',
      });
    }
    if (next() < 0.07) {
      const occurredAt = new Date(
        start.getTime() + Math.floor((end.getTime() - start.getTime()) / 2),
      );
      const state = alertState(occurredAt, anchor, !openVehicles.has(vehicle.row.id));
      if (state.alertStatus === 'OPEN') {
        openVehicles.add(vehicle.row.id);
      }
      data.events.push({
        ...base,
        ...state,
        id: demoId('event', `${trip.id}:speeding`),
        occurredAt,
        kind: 'SPEEDING',
        severity: 'WARNING',
        intensity: 2,
        measuredValue: 104,
        thresholdValue: 90,
        speedKph: 104,
        details: 'Synthetic speed-limit event.',
      });
    }
    if (trip.maxSpeedKph === 118) {
      const occurredAt = new Date(start.getTime() + 30 * 60_000);
      data.events.push({
        ...base,
        ...alertState(occurredAt, anchor, false),
        id: demoId('event', `${trip.id}:speeding-118`),
        occurredAt,
        kind: 'SPEEDING',
        severity: 'WARNING',
        intensity: 3,
        measuredValue: 118,
        thresholdValue: 90,
        speedKph: 118,
      });
    }
  }
  const storyline = (
    key: string,
    number: number,
    hoursAgo: number,
    kind: FleetEventKind,
    severity: 'WARNING' | 'CRITICAL',
    fields: Partial<Prisma.FleetEventCreateManyInput> = {},
  ) => {
    const vehicle = vehicles.find((vehicle) => vehicle.number === number);
    if (!vehicle) {
      throw new Error('Missing storyline vehicle.');
    }
    const occurredAt = new Date(anchor.getTime() - hoursAgo * HOUR_MS);
    data.events.push({
      id: demoId('event', `storyline:${key}`),
      ...DEMO_SCOPE,
      vehicleId: vehicle.row.id,
      driverId: vehicle.row.currentDriverId ?? null,
      deviceImei: vehicle.primary?.imei ?? null,
      source: 'DEMO',
      occurredAt,
      kind,
      severity,
      alertStatus: 'OPEN',
      details: `Synthetic demo storyline ${key}.`,
      createdAt: anchor,
      updatedAt: anchor,
      ...fields,
    });
  };
  storyline('a', 4, 35 / 60, 'DIAGNOSTIC_TROUBLE_CODE', 'CRITICAL', {
    troubleCode: 'SPN 110 FMI 0',
    details: 'Coolant temperature high (104 °C)',
  });
  storyline('b', 28, 51, 'SPEEDING', 'WARNING', {
    intensity: 3,
    measuredValue: 128,
    thresholdValue: 90,
    speedKph: 128,
    alertStatus: 'ACKNOWLEDGED',
    acknowledgedAt: new Date(anchor.getTime() - 51 * HOUR_MS + 40 * 60_000),
    remark: 'Разговор с водача в петък',
  });
  storyline('c-power', 44, 6 * 24, 'POWER_DISCONNECTED', 'CRITICAL', {
    measuredValue: 0,
    thresholdValue: 9,
  });
  storyline('c-battery', 44, 5 * 24 + 21, 'LOW_BACKUP_BATTERY', 'WARNING', {
    measuredValue: 3.45,
    thresholdValue: 3.5,
  });
  storyline('c-offline', 44, 5 * 24 + 18, 'DEVICE_OFFLINE', 'WARNING', {
    measuredValue: 120,
    thresholdValue: 120,
  });
  storyline('d', 7, 6 + 50 / 60, 'FUEL_DROP', 'CRITICAL', {
    measuredValue: 22,
    thresholdValue: 10,
  });
  storyline('e', 10, 25 / 60, 'LOW_FUEL', 'WARNING', { measuredValue: 9, thresholdValue: 12 });
  storyline('f', 3, 3, 'CAN_DISCONNECTED', 'WARNING');
  storyline('g', 12, 9 * 24, 'CRASH_DETECTED', 'CRITICAL', {
    alertStatus: 'RESOLVED',
    acknowledgedAt: new Date(anchor.getTime() - 9 * DAY_MS + 6 * 60_000),
    resolvedAt: new Date(anchor.getTime() - 9 * DAY_MS + 3 * HOUR_MS),
    remark: 'Демонстрационен преглед. '.repeat(50).slice(0, 1000),
  });
  storyline('h', 11, 5, 'DIAGNOSTIC_TROUBLE_CODE', 'CRITICAL', { troubleCode: 'P0299' });
  storyline('i', 13, 32 / 60, 'IDLING', 'WARNING', { measuredValue: 47, thresholdValue: 15 });
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    storyline(`j-${String(ordinal)}`, 8, ordinal * 6, 'SPEEDING', 'WARNING', {
      intensity: 2,
      measuredValue: 105,
      thresholdValue: 90,
    });
  }
  storyline('k', 15, 4 * 24, 'IDLING', 'WARNING', {
    alertStatus: 'RESOLVED',
    acknowledgedAt: null,
    resolvedAt: new Date(anchor.getTime() - 4 * DAY_MS + HOUR_MS),
  });
  storyline('l', 26, 4 * 24, 'CAN_DISCONNECTED', 'WARNING', {
    alertStatus: 'RESOLVED',
    acknowledgedAt: new Date(anchor.getTime() - 4 * DAY_MS + HOUR_MS),
    resolvedAt: new Date(anchor.getTime() - 4 * DAY_MS + 2 * HOUR_MS),
    details: '<b>Door</b> sensor "open" & alarm',
  });
}

function createServiceTasks(
  data: FleetDemoDataset,
  vehicles: readonly DemoVehicle[],
  anchor: Date,
): void {
  const anchorDate = sofiaDate(anchor);
  let costOrdinal = 0;
  for (const vehicle of vehicles) {
    const next = rng(`service:${String(vehicle.number)}`);
    const current = Math.floor(
      odometerAt(
        vehicle,
        data.trips.filter((trip) => trip.vehicleId === vehicle.row.id),
        anchor,
      ) ?? 0,
    );
    const task = (
      key: string,
      fields: Omit<Prisma.ServiceTaskCreateManyInput, 'id' | 'tenantId' | 'branchId' | 'vehicleId'>,
    ) =>
      data.serviceTasks.push({
        id: demoId('service', `${String(vehicle.number)}:${key}`),
        ...DEMO_SCOPE,
        vehicleId: vehicle.row.id,
        createdAt: anchor,
        updatedAt: anchor,
        ...fields,
      });
    const history = vehicle.number <= 20 ? 3 : vehicle.number <= 37 ? 2 : 1;
    for (let ordinal = 1; ordinal <= history; ordinal++) {
      const completedOn = new Date(`${addDays(anchorDate, -ordinal * 150)}T00:00:00Z`);
      task(`history:${String(ordinal)}`, {
        status: 'DONE',
        serviceType:
          vehicle.number >= 43
            ? ordinal % 2
              ? 'BRAKES'
              : 'TIRES'
            : ordinal % 2
              ? 'GENERAL_SERVICE'
              : 'OIL_CHANGE',
        title: 'Демонстрационно извършено обслужване',
        completedOn,
        completedOdometerKm: vehicle.number >= 43 ? null : Math.max(0, current - ordinal * 20_000),
        workshop: 'Демонстрационен сервиз',
        replacedParts: ordinal === 1 ? 'Маслен филтър; консумативи' : null,
        costCents:
          costOrdinal < 3
            ? 0
            : costOrdinal < 7
              ? null
              : randomInt(
                  next,
                  vehicle.number <= 20 ? 35_000 : 12_000,
                  vehicle.number <= 20 ? 180_000 : 60_000,
                ),
        notes: 'Synthetic service history; amounts are EUR cents.',
      });
      costOrdinal++;
    }
    if (vehicle.number <= 4) {
      task('cancelled', {
        status: 'CANCELLED',
        serviceType: 'REPAIR',
        title: 'Демонстрационно отменена заявка',
        dueOn: new Date(`${addDays(anchorDate, -5)}T00:00:00Z`),
        notes: 'Отменено след повторна диагностика.',
      });
    }
    const overdueDate: Readonly<Record<number, number>> = { 3: -9, 8: -2, 29: -15, 44: -20 };
    const soonDate: Readonly<Record<number, number>> = {
      5: 0,
      22: 0,
      24: 0,
      30: 0,
      12: 9,
      27: 6,
      31: 18,
      32: 22,
      33: 25,
      35: 29,
    };
    const type: FleetServiceType =
      vehicle.number === 3
        ? 'OIL_CHANGE'
        : vehicle.number === 8
          ? 'BRAKES'
          : vehicle.number === 44
            ? 'TIRES'
            : [27, 29, 31, 32, 33, 35].includes(vehicle.number)
              ? 'ANNUAL_INSPECTION'
              : workshopVehicles.includes(vehicle.number)
                ? 'REPAIR'
                : 'GENERAL_SERVICE';
    const offset = overdueDate[vehicle.number] ?? soonDate[vehicle.number] ?? 45;
    const kmOnly = [11, 17, 15, 19].includes(vehicle.number);
    task('planned', {
      status: 'PLANNED',
      serviceType: type,
      title: 'Демонстрационно планирано обслужване',
      dueOn: kmOnly ? null : new Date(`${addDays(anchorDate, offset)}T00:00:00Z`),
      dueOdometerKm:
        vehicle.number === 11
          ? current - 350
          : vehicle.number === 17
            ? current - 1200
            : vehicle.number === 15
              ? current + 900
              : vehicle.number === 19
                ? 15_000
                : null,
      workshop: vehicle.number % 3 ? 'Демонстрационен сервиз' : null,
      notes: 'Synthetic service plan.',
    });
    if (vehicle.number <= 26) {
      task('calibration', {
        status: 'PLANNED',
        serviceType: 'TACHOGRAPH_CALIBRATION',
        title: 'Демонстрационна проверка на тахограф',
        dueOn: new Date(`${addDays(anchorDate, 60)}T00:00:00Z`),
      });
    }
  }
}

/** Pure deterministic fixtures. No reads, writes, environment access or application fixture imports. */
export function generateFleetDemo({ anchor }: { anchor: Date }): FleetDemoDataset {
  if (!Number.isFinite(anchor.getTime())) {
    throw new Error('Use a valid Fleet demo anchor.');
  }
  const data: FleetDemoDataset = {
    groups: [],
    drivers: [],
    vehicles: [],
    devices: [],
    serviceTasks: [],
    trips: [],
    samples: [],
    events: [],
  };
  const vehicles = masterData(data, anchor);
  createTrips(data, vehicles, anchor);
  createSamples(data, vehicles, anchor);
  createEvents(data, vehicles, anchor);
  createServiceTasks(data, vehicles, anchor);
  for (const rows of [
    data.groups,
    data.drivers,
    data.vehicles,
    data.devices,
    data.serviceTasks,
    data.trips,
    data.samples,
    data.events,
  ]) {
    rows.sort((left, right) => left.id.localeCompare(right.id));
  }
  return data;
}
