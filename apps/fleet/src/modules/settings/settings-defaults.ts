import type { FleetSettings } from '../../generated/graphql/types.js';
import {
  BUSINESS_TIME_ZONE,
  LOW_FUEL_PERCENT,
  NOT_CONNECTED_AFTER_HOURS,
} from '../../fleet-thresholds.js';

/** Unsaved Branches use explicit defaults; this function has no persistence or cache. */
export function defaultFleetSettings(): FleetSettings {
  return {
    timeZone: BUSINESS_TIME_ZONE,
    dateFormat: 'YYYY_MM_DD',
    distanceUnit: 'KM',
    volumeUnit: 'LITRE',
    lowFuelPct: LOW_FUEL_PERCENT,
    notReportingHours: NOT_CONNECTED_AFTER_HOURS,
    speedLimitKph: 90,
    notificationRetentionDays: 7,
  };
}
