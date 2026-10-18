// Deterministic, synthetic English sample data for the example pages. Story-only: never imported by
// application code. Every run produces the same rows; dates are relative to the story clock.

export const sampleNow = Date.parse('2026-10-18T07:00:00.000Z');
const day = 86_400_000;
const minute = 60_000;

/** Small seeded generator (mulberry32), so samples never change between runs. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Empty sample list.');
  return item;
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function dateOnly(time: number): string {
  return iso(time).slice(0, 10);
}

export type VehicleStatus = 'ACTIVE' | 'IN_WORKSHOP' | 'INACTIVE';
export type VehicleActivity = 'MOVING' | 'IDLE' | 'PARKED' | 'NOT_CONNECTED' | 'NO_DEVICE';
export type VehicleType = 'TRACTOR' | 'RIGID_TRUCK' | 'VAN' | 'CAR';

export interface SampleGroup {
  readonly id: string;
  readonly name: string;
  readonly slot: string;
  readonly description: string;
}

export interface SampleDriver {
  readonly id: string;
  readonly name: string;
  readonly employeeNo: string;
  readonly phone: string;
  readonly email: string;
  readonly status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  readonly licenseExpiresOn: string;
  readonly tachoCardExpiresOn: string;
  readonly score: number | null;
  readonly trips30d: number;
  readonly distance30dKm: number;
  readonly notes: string;
}

export interface SampleVehicle {
  readonly id: string;
  readonly plate: string;
  readonly fleetNumber: string;
  readonly type: VehicleType;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly vin: string;
  readonly fuelType: 'DIESEL' | 'PETROL' | 'ELECTRIC' | 'LPG';
  readonly tankL: number | null;
  readonly status: VehicleStatus;
  readonly groupId: string | null;
  readonly driverId: string | null;
  readonly odometerKm: number;
  readonly activity: VehicleActivity;
  readonly speedKph: number | null;
  readonly fuelPct: number | null;
  readonly lastReportedAt: string | null;
  readonly location: string | null;
  readonly openAlerts: number;
  readonly notes: string;
  readonly createdAt: string;
}

export interface SampleTripEvent {
  readonly at: string;
  readonly kind: string;
  readonly detail: string;
  readonly severity: 'info' | 'warn' | 'danger';
}

export interface SampleTrip {
  readonly id: string;
  readonly vehicleId: string;
  readonly driverId: string | null;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly from: string;
  readonly to: string;
  readonly distanceKm: number;
  readonly durationMin: number;
  readonly maxSpeedKph: number;
  readonly fuelUsedL: number | null;
  readonly score: number | null;
  readonly events: readonly SampleTripEvent[];
}

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SampleAlert {
  readonly id: string;
  readonly vehicleId: string;
  readonly driverId: string | null;
  readonly kind: string;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly occurredAt: string;
  readonly detail: string;
  readonly remark: string;
}

export interface SampleServiceTask {
  readonly id: string;
  readonly vehicleId: string;
  readonly kind: string;
  readonly dueOn: string | null;
  readonly dueKm: number | null;
  readonly status: 'PLANNED' | 'DONE';
  readonly urgency: 'OVERDUE' | 'DUE_SOON' | 'OK' | 'DONE';
  readonly costEur: number | null;
  readonly notes: string;
}

export const sampleGroups: readonly SampleGroup[] = [
  { id: 'g1', name: 'International', slot: 'c1', description: 'Long-haul EU routes' },
  { id: 'g2', name: 'Domestic', slot: 'c2', description: 'Routes inside Bulgaria' },
  { id: 'g3', name: 'City', slot: 'c3', description: 'Sofia city deliveries' },
  { id: 'g4', name: 'Reserve', slot: 'c4', description: 'Spare and seasonal vehicles' },
];

const firstNames = [
  'Ivan',
  'Georgi',
  'Dimitar',
  'Nikolay',
  'Petar',
  'Stoyan',
  'Martin',
  'Kaloyan',
  'Elena',
  'Maria',
  'Viktor',
  'Todor',
  'Hristo',
  'Radoslav',
  'Simeon',
  'Asen',
  'Boris',
  'Yana',
  'Plamen',
  'Krasimir',
  'Angel',
  'Lyubomir',
];
const lastNames = [
  'Petrov',
  'Georgiev',
  'Dimitrov',
  'Ivanov',
  'Nikolov',
  'Stoyanov',
  'Todorov',
  'Hristov',
  'Angelov',
  'Kolev',
  'Marinov',
  'Popov',
  'Iliev',
  'Vasilev',
  'Atanasov',
];

function buildDrivers(): SampleDriver[] {
  const random = seeded(11);
  return Array.from({ length: 22 }, (_, index) => {
    const first = firstNames[index % firstNames.length] ?? 'Ivan';
    const last = pick(random, lastNames);
    const female = ['Elena', 'Maria', 'Yana'].includes(first);
    const name = `${first} ${female ? `${last}a` : last}`;
    const license = sampleNow + Math.floor((random() * 900 - 60) * day);
    const tacho = sampleNow + Math.floor((random() * 700 - 30) * day);
    const status = index === 7 ? 'ON_LEAVE' : index === 19 ? 'INACTIVE' : 'ACTIVE';
    const trips = status === 'ACTIVE' ? 6 + Math.floor(random() * 30) : 0;
    return {
      id: `d${String(index + 1).padStart(2, '0')}`,
      name,
      employeeNo: `E-${String(1040 + index * 7)}`,
      phone: `+359 88 ${String(1000000 + Math.floor(random() * 8999999)).replace(/(\d{3})(\d{4})/, '$1 $2')}`,
      email: `${first}.${female ? `${last}a` : last}@demo-logistics.example`.toLowerCase(),
      status,
      licenseExpiresOn: dateOnly(license),
      tachoCardExpiresOn: dateOnly(index === 3 ? sampleNow - 12 * day : tacho),
      score: trips < 5 ? null : Math.round(62 + random() * 36),
      trips30d: trips,
      distance30dKm: trips * Math.round(140 + random() * 260),
      notes:
        index === 2
          ? 'Prefers night shifts. ADR certificate for dangerous goods valid until 2028; refresher course booked for spring.'
          : index % 5 === 0
            ? 'Trainer for new drivers.'
            : '',
    };
  });
}

export const sampleDrivers: readonly SampleDriver[] = buildDrivers();

const models: readonly {
  make: string;
  model: string;
  type: VehicleType;
  tank: number | null;
  fuel: SampleVehicle['fuelType'];
}[] = [
  { make: 'MAN', model: 'TGX 18.510', type: 'TRACTOR', tank: 800, fuel: 'DIESEL' },
  { make: 'Volvo', model: 'FH 500', type: 'TRACTOR', tank: 900, fuel: 'DIESEL' },
  { make: 'DAF', model: 'XF 480', type: 'TRACTOR', tank: 845, fuel: 'DIESEL' },
  { make: 'Scania', model: 'R 450', type: 'TRACTOR', tank: 700, fuel: 'DIESEL' },
  { make: 'Mercedes-Benz', model: 'Actros 1845', type: 'TRACTOR', tank: 760, fuel: 'DIESEL' },
  { make: 'Iveco', model: 'Eurocargo 120E', type: 'RIGID_TRUCK', tank: 200, fuel: 'DIESEL' },
  { make: 'Mercedes-Benz', model: 'Sprinter 316', type: 'VAN', tank: 71, fuel: 'DIESEL' },
  { make: 'Ford', model: 'E-Transit', type: 'VAN', tank: null, fuel: 'ELECTRIC' },
  { make: 'Renault', model: 'Master', type: 'VAN', tank: 80, fuel: 'DIESEL' },
  { make: 'Skoda', model: 'Octavia Combi', type: 'CAR', tank: 50, fuel: 'PETROL' },
];
const regions = ['CB', 'CA', 'PB', 'B', 'A', 'CO'];
const series = ['AX', 'BK', 'HT', 'MK', 'PA', 'TE'];
const places = [
  'Sofia, Iliyantsi',
  'Sofia, Druzhba',
  'Plovdiv, Trakia',
  'Varna, Port West',
  'Burgas, Lukoil',
  'Ruse, Danube Bridge',
  'Pernik, Industrial zone',
  'Stara Zagora',
  'Thessaloniki, GR',
  'Bucharest, RO',
  'Nis, RS',
  'Kulata border crossing',
];
const noteSamples = [
  '',
  'International routes; tachograph calibrated in September.',
  'Driver reports vibration above 90 km/h. Check wheel balance, suspension bushings and the propeller shaft before the next long trip to Thessaloniki.',
  'Refrigerated body, used for the Sofia – Varna dairy route.',
  '',
  'Spare vehicle for the winter season.',
  'Lease contract until 2027.',
  '',
];

function buildVehicles(): SampleVehicle[] {
  const random = seeded(7);
  return Array.from({ length: 46 }, (_, index) => {
    const spec = models[index % models.length] ?? models[0];
    if (!spec) throw new Error('Missing model.');
    const status: VehicleStatus =
      index % 13 === 4 ? 'IN_WORKSHOP' : index % 17 === 9 ? 'INACTIVE' : 'ACTIVE';
    const activity: VehicleActivity =
      status === 'INACTIVE'
        ? 'NOT_CONNECTED'
        : index % 15 === 14
          ? 'NO_DEVICE'
          : index % 11 === 6
            ? 'NOT_CONNECTED'
            : pick(random, ['MOVING', 'MOVING', 'IDLE', 'PARKED', 'PARKED'] as const);
    const reported =
      activity === 'NO_DEVICE'
        ? null
        : activity === 'NOT_CONNECTED'
          ? sampleNow - Math.floor((50 + random() * 200) * 60 * minute)
          : sampleNow - Math.floor(random() * 15 * minute);
    const driver = sampleDrivers[(index * 3) % sampleDrivers.length];
    return {
      id: `v${String(index + 1).padStart(2, '0')}`,
      plate: `${regions[index % regions.length] ?? 'CB'} ${String(1001 + index * 37).slice(-4)} ${series[(index * 5) % series.length] ?? 'AX'}`,
      fleetNumber: `${spec.type === 'TRACTOR' ? 'T' : spec.type === 'VAN' ? 'V' : spec.type === 'CAR' ? 'C' : 'R'}-${String(index + 1).padStart(2, '0')}`,
      type: spec.type,
      make: spec.make,
      model: spec.model,
      year: 2015 + Math.floor(random() * 11),
      vin: `WMA06XZZ${String(1 + (index % 9))}MP${String(123400 + index * 13).padStart(6, '0')}`,
      fuelType: spec.fuel,
      tankL: spec.tank,
      status,
      groupId: index % 9 === 8 ? null : (sampleGroups[index % sampleGroups.length]?.id ?? null),
      driverId: status === 'ACTIVE' && index % 6 !== 5 ? (driver?.id ?? null) : null,
      odometerKm:
        spec.type === 'CAR'
          ? 18000 + Math.floor(random() * 90000)
          : 40000 + Math.floor(random() * 620000),
      activity,
      speedKph:
        activity === 'MOVING' ? Math.round(38 + random() * 52) : activity === 'IDLE' ? 0 : null,
      fuelPct:
        spec.fuel === 'ELECTRIC' || activity === 'NO_DEVICE'
          ? null
          : index % 14 === 3
            ? 8
            : Math.round(15 + random() * 80),
      lastReportedAt: reported === null ? null : iso(reported),
      location: activity === 'NO_DEVICE' ? null : pick(random, places),
      openAlerts: index % 7 === 2 ? 1 + Math.floor(random() * 3) : 0,
      notes: noteSamples[index % noteSamples.length] ?? '',
      createdAt: iso(Date.parse('2025-02-03T09:00:00Z') + index * 6 * day),
    };
  });
}

export const sampleVehicles: readonly SampleVehicle[] = buildVehicles();

const tripEventKinds = [
  { kind: 'Harsh braking', severity: 'warn' },
  { kind: 'Harsh acceleration', severity: 'warn' },
  { kind: 'Overspeed', severity: 'danger' },
  { kind: 'Long idle', severity: 'info' },
  { kind: 'Sharp turn', severity: 'warn' },
] as const;

function buildTrips(): SampleTrip[] {
  const random = seeded(23);
  const active = sampleVehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
  return Array.from({ length: 64 }, (_, index) => {
    const vehicle = active[(index * 7) % active.length] ?? active[0];
    if (!vehicle) throw new Error('Missing vehicle.');
    const start = sampleNow - Math.floor((index * 4.3 + random() * 3) * 60 * minute);
    const durationMin = Math.round(25 + random() * 420);
    const distanceKm = Math.round((durationMin / 60) * (45 + random() * 30));
    const events = Array.from({ length: Math.floor(random() * 4) }, (_, eventIndex) => {
      const kind = pick(random, tripEventKinds);
      const at = start + Math.floor(((eventIndex + 1) / 5) * durationMin * minute);
      return {
        at: iso(at),
        kind: kind.kind,
        severity: kind.severity,
        detail:
          kind.kind === 'Overspeed'
            ? `${String(98 + Math.floor(random() * 22))} km/h in a 90 zone`
            : 'Device-reported manoeuvre',
      } satisfies SampleTripEvent;
    });
    return {
      id: `t${String(index + 1).padStart(3, '0')}`,
      vehicleId: vehicle.id,
      driverId: vehicle.driverId,
      startedAt: iso(start),
      endedAt: iso(start + durationMin * minute),
      from: pick(random, places),
      to: pick(random, places),
      distanceKm,
      durationMin,
      maxSpeedKph: Math.round(70 + random() * 45),
      fuelUsedL:
        vehicle.fuelType === 'ELECTRIC' ? null : Math.round(distanceKm * (0.22 + random() * 0.12)),
      score: distanceKm < 1 ? null : Math.round(60 + random() * 39 - events.length * 4),
      events,
    };
  });
}

export const sampleTrips: readonly SampleTrip[] = buildTrips();

const alertKinds = [
  { kind: 'Overspeed', severity: 'WARNING', detail: '112 km/h on the A1 (limit 90 for trucks).' },
  {
    kind: 'Engine fault code P0299',
    severity: 'CRITICAL',
    detail: 'Turbocharger underboost reported by the engine ECU.',
  },
  { kind: 'Low fuel', severity: 'WARNING', detail: 'Fuel level 8 % while moving.' },
  { kind: 'Device offline', severity: 'WARNING', detail: 'No data for more than 48 hours.' },
  { kind: 'Harsh braking', severity: 'INFO', detail: 'Deceleration 0.52 g.' },
  {
    kind: 'Battery voltage low',
    severity: 'CRITICAL',
    detail: 'External voltage 10.9 V with ignition off.',
  },
  {
    kind: 'Unplanned stop',
    severity: 'INFO',
    detail: 'Stopped 54 min outside a planned location.',
  },
] as const;

function buildAlerts(): SampleAlert[] {
  const random = seeded(31);
  return Array.from({ length: 38 }, (_, index) => {
    const kind = alertKinds[index % alertKinds.length] ?? alertKinds[0];
    const vehicle = sampleVehicles[(index * 5 + 2) % sampleVehicles.length] ?? sampleVehicles[0];
    if (!vehicle) throw new Error('Missing vehicle.');
    const status: AlertStatus = index < 14 ? 'OPEN' : index < 24 ? 'ACKNOWLEDGED' : 'RESOLVED';
    return {
      id: `a${String(index + 1).padStart(3, '0')}`,
      vehicleId: vehicle.id,
      driverId: vehicle.driverId,
      kind: kind.kind,
      severity: kind.severity,
      status,
      occurredAt: iso(sampleNow - Math.floor((index * 2.6 + random() * 2) * 60 * minute)),
      detail: kind.detail,
      remark:
        status === 'RESOLVED'
          ? 'Checked with the driver; no further action.'
          : status === 'ACKNOWLEDGED'
            ? 'Workshop informed.'
            : '',
    };
  });
}

export const sampleAlerts: readonly SampleAlert[] = buildAlerts();

const serviceKinds = [
  'Oil and filter change',
  'Annual technical inspection',
  'Tachograph calibration',
  'Tyre replacement',
  'Brake pads',
  'Air-conditioning service',
];

function buildServiceTasks(): SampleServiceTask[] {
  const random = seeded(41);
  return Array.from({ length: 30 }, (_, index) => {
    const vehicle = sampleVehicles[(index * 3 + 1) % sampleVehicles.length] ?? sampleVehicles[0];
    if (!vehicle) throw new Error('Missing vehicle.');
    const done = index >= 22;
    const offsetDays = done ? -10 - index : Math.round(-20 + index * 4 - random() * 6);
    const dueOn = index % 3 === 2 ? null : dateOnly(sampleNow + offsetDays * day);
    const dueKm = index % 3 === 0 ? null : vehicle.odometerKm + Math.round(-1500 + index * 900);
    const urgency = done
      ? 'DONE'
      : (dueOn !== null && offsetDays < 0) || (dueKm !== null && dueKm <= vehicle.odometerKm)
        ? 'OVERDUE'
        : (dueOn !== null && offsetDays <= 14) ||
            (dueKm !== null && dueKm - vehicle.odometerKm <= 1500)
          ? 'DUE_SOON'
          : 'OK';
    return {
      id: `s${String(index + 1).padStart(3, '0')}`,
      vehicleId: vehicle.id,
      kind: serviceKinds[index % serviceKinds.length] ?? 'Service',
      dueOn,
      dueKm,
      status: done ? 'DONE' : 'PLANNED',
      urgency,
      costEur: done ? Math.round(80 + random() * 900) : null,
      notes: index % 4 === 1 ? 'Book the Plovdiv workshop; parts are in stock.' : '',
    };
  });
}

export const sampleServiceTasks: readonly SampleServiceTask[] = buildServiceTasks();

export function vehicleById(id: string): SampleVehicle | undefined {
  return sampleVehicles.find((vehicle) => vehicle.id === id);
}

export function driverById(id: string | null): SampleDriver | undefined {
  return id === null ? undefined : sampleDrivers.find((driver) => driver.id === id);
}

export function groupById(id: string | null): SampleGroup | undefined {
  return id === null ? undefined : sampleGroups.find((group) => group.id === id);
}
