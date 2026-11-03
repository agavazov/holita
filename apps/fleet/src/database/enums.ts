import type {
  FleetDistanceUnit,
  FleetVolumeUnit,
  FleetVehicleType,
  FleetFuelType,
  FleetVehicleStatus,
  FleetDeviceModel,
  FleetDeviceOption,
  FleetDriverStatus,
  FleetLicenseCategory,
  FleetGroupColor,
  FleetDataSource,
  FleetEventKind,
  FleetServiceType,
  FleetServiceStatus,
} from '../generated/prisma/enums.js';

// Raw SQL bypasses Prisma's enum mapping; keep these database values explicit.

export const fleetDistanceUnitDb = {
  KM: 'km',
  MI: 'mi',
} satisfies Record<FleetDistanceUnit, string>;

export const fleetVolumeUnitDb = {
  LITRE: 'litre',
  US_GALLON: 'usGallon',
} satisfies Record<FleetVolumeUnit, string>;

export const fleetVehicleTypeDb = {
  TRACTOR: 'tractor',
  RIGID_TRUCK: 'rigidTruck',
  VAN: 'van',
  CAR: 'car',
  TRAILER: 'trailer',
  OTHER: 'other',
} satisfies Record<FleetVehicleType, string>;

export const fleetFuelTypeDb = {
  DIESEL: 'diesel',
  PETROL: 'petrol',
  LPG: 'lpg',
  CNG: 'cng',
  ELECTRIC: 'electric',
  HYBRID: 'hybrid',
} satisfies Record<FleetFuelType, string>;

export const fleetVehicleStatusDb = {
  ACTIVE: 'active',
  IN_WORKSHOP: 'inWorkshop',
  INACTIVE: 'inactive',
} satisfies Record<FleetVehicleStatus, string>;

export const fleetDeviceModelDb = {
  STARLINK_TRACKER: 'starlinkTracker',
  STARLINK_SCOUT: 'starlinkScout',
  OTHER: 'other',
} satisfies Record<FleetDeviceModel, string>;

export const fleetDeviceOptionDb = {
  CELLULAR_4G: 'cellular4g',
  SAFETY_SF: 'safetySf',
  IRF: 'irf',
  CAN: 'can',
  DRIVER_ID: 'driverId',
  GEOZONES_GO: 'geozonesGo',
  TEMPERATURE_DS: 'temperatureDs',
  ECONNECT: 'econnect',
  WIFI: 'wifi',
  VOICE: 'voice',
  EXTERNAL_ANTENNA: 'externalAntenna',
  RS232: 'rs232',
  WILIOT: 'wiliot',
} satisfies Record<FleetDeviceOption, string>;

export const fleetDriverStatusDb = {
  ACTIVE: 'active',
  ON_LEAVE: 'onLeave',
  INACTIVE: 'inactive',
} satisfies Record<FleetDriverStatus, string>;

export const fleetLicenseCategoryDb = {
  B: 'b',
  BE: 'be',
  C1: 'c1',
  C1E: 'c1e',
  C: 'c',
  CE: 'ce',
  D1: 'd1',
  D1E: 'd1e',
  D: 'd',
  DE: 'de',
} satisfies Record<FleetLicenseCategory, string>;

export const fleetGroupColorDb = {
  C1: 'c1',
  C2: 'c2',
  C3: 'c3',
  C4: 'c4',
  C5: 'c5',
  C6: 'c6',
  C7: 'c7',
  C8: 'c8',
} satisfies Record<FleetGroupColor, string>;

export const fleetDataSourceDb = {
  DEMO: 'demo',
  MANUAL: 'manual',
  ERM: 'erm',
} satisfies Record<FleetDataSource, string>;

export const fleetEventKindDb = {
  HARSH_ACCELERATION: 'harshAcceleration',
  HARSH_BRAKING: 'harshBraking',
  SPEED_BUMP: 'speedBump',
  OVERTAKING: 'overtaking',
  ROUNDABOUT: 'roundabout',
  LANE_CHANGE: 'laneChange',
  SHARP_TURN: 'sharpTurn',
  OFF_ROAD: 'offRoad',
  SPEEDING: 'speeding',
  IGNITION_ON: 'ignitionOn',
  IGNITION_OFF: 'ignitionOff',
  IDLING: 'idling',
  LOW_FUEL: 'lowFuel',
  FUEL_DROP: 'fuelDrop',
  POWER_DISCONNECTED: 'powerDisconnected',
  LOW_BACKUP_BATTERY: 'lowBackupBattery',
  CAN_DISCONNECTED: 'canDisconnected',
  DEVICE_OFFLINE: 'deviceOffline',
  DIAGNOSTIC_TROUBLE_CODE: 'diagnosticTroubleCode',
  CRASH_DETECTED: 'crashDetected',
} satisfies Record<FleetEventKind, string>;

export const fleetServiceTypeDb = {
  GENERAL_SERVICE: 'generalService',
  OIL_CHANGE: 'oilChange',
  ANNUAL_INSPECTION: 'annualInspection',
  TACHOGRAPH_CALIBRATION: 'tachographCalibration',
  BRAKES: 'brakes',
  TIRES: 'tires',
  REPAIR: 'repair',
  OTHER: 'other',
} satisfies Record<FleetServiceType, string>;

export const fleetServiceStatusDb = {
  PLANNED: 'planned',
  DONE: 'done',
  CANCELLED: 'cancelled',
} satisfies Record<FleetServiceStatus, string>;
