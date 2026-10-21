import type { FleetRecordLinks } from '../../app/features/fleet/fleet-record-links';

/** The examples keep their existing profile routes and Driver drawer query parameter. */
export const sampleRecordLinks: FleetRecordLinks = {
  vehicle: (id) => ({ commands: ['/', 'examples', 'vehicles', id] }),
  driver: (id) => ({ commands: ['/', 'examples', 'drivers'], queryParams: { drawer: id } }),
};
