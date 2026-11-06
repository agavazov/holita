import type {
  AdminVehicleMapQuery,
  AdminVehicleTrackQuery,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { fleetLiveText } from '../../../ui/fleet-live/fleet-live';
import { interpolate } from '../../../ui/i18n/messages';
import type { LocationMapRecord, LocationMapTrack } from '../../../ui/location-map/location-map';
import type { VehicleProfile } from './vehicle-profile-view';
import { vehicleConnectionStatus } from './vehicle-live';
import en from './vehicle-profile-map.en.json';
import bg from './vehicle-profile-map.bg.json';

const messages: Record<Language, typeof en> = { en, bg };

export function vehicleMapRecords(
  page: AdminVehicleMapQuery['fleetMap'] | null,
  vehicle: VehicleProfile | null,
  language: Language,
): readonly LocationMapRecord[] {
  if (!vehicle) {
    return [];
  }
  const item = page?.items.find((item) => item.vehicle.id === vehicle.id);
  const position = item?.position;
  return [
    {
      id: vehicle.id,
      label: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
      plate: vehicle.plate,
      status: item
        ? vehicleConnectionStatus({ ...item, hasDevices: vehicle.devices.length > 0 }, language)
        : { label: fleetLiveText(language).unavailable, tone: 'neutral' },
      position: position ? { latitude: position.latitude, longitude: position.longitude } : null,
      positionAt: position?.recordedAt ?? null,
      heading: position?.headingDeg ?? null,
    },
  ];
}

export function vehicleRecordedTrack(
  series: AdminVehicleTrackQuery['fleetVehicleSamples'] | null,
  language: Language,
): LocationMapTrack | null {
  if (!series) {
    return null;
  }
  const samples = new Map(series.items.map((item) => [item.id, item]));
  return {
    recordId: series.vehicleId,
    from: series.from,
    to: series.to,
    truncated: series.truncated,
    coverage: interpolate(messages[language].coverage, {
      positions: series.track.positionCount,
      segments: series.track.segments.length,
      gaps: series.track.gaps.length,
    }),
    points: series.track.segments.flatMap((segment) =>
      segment.sampleIds.flatMap((id, index) => {
        const sample = samples.get(id);
        return sample
          ? [
              {
                recordedAt: sample.recordedAt,
                position:
                  sample.latitude === null || sample.longitude === null
                    ? null
                    : { latitude: sample.latitude, longitude: sample.longitude },
                breakBefore: index === 0,
              },
            ]
          : [];
      }),
    ),
  };
}
