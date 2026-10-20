// Fleet fixed thresholds and defaults for configurable Branch settings.
// TypeScript classifiers and raw SQL use scoped settings where configurable.
// Units are holita's demo contract: km, km/h, litres, volts, °C, minutes, percent, 0–100 scores
// and EUR cents. No equivalence with Karma values is claimed.

/** Default Branch time zone for business dates and daily-distance buckets. */
export const BUSINESS_TIME_ZONE = 'Europe/Sofia';
/** Default reporting window; Branch settings configure NOT_CONNECTED/OFFLINE cutoffs. */
export const NOT_CONNECTED_AFTER_HOURS = 48;
/** Ignition on and speed ≥ 5 km/h ⇒ `MOVING`. */
export const MOVING_MIN_SPEED_KPH = 5;
/** Default LOW boundary; Branch settings configure the fresh-fuel percentage. */
export const LOW_FUEL_PERCENT = 12;
/** Older fuel readings ⇒ `STALE`. */
export const FUEL_READING_MAX_AGE_HOURS = 6;
/** Due date within 14 days ⇒ `DUE_SOON`. */
export const SERVICE_DUE_SOON_DAYS = 14;
/** Due odometer within 1,500 km ⇒ `DUE_SOON`. */
export const SERVICE_DUE_SOON_KM = 1500;
/** Driver document expiring within 30 days. */
export const DOCUMENT_EXPIRING_DAYS = 30;
/** Three or more open WARNING alerts ⇒ attention reason. */
export const ATTENTION_WARNING_ALERTS = 3;
/** Trips shorter than this never count towards scores. */
export const SCORE_MIN_DISTANCE_KM = 0.5;
/** A trip without end that started within 24 h of `asOf` ⇒ `inProgress`. */
export const OPEN_TRIP_MAX_HOURS = 24;
/** Overview usage window. */
export const KPI_WINDOW_DAYS = 7;
/** Driver list statistics window. */
export const DRIVER_STATS_DAYS = 30;
/** Scorecards with fewer trips are low confidence. */
export const LOW_CONFIDENCE_TRIPS = 5;
