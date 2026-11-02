import type { SourceProvenance } from '../../../../ui/source-context/source-types';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { KarmaTripFieldsFragment } from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { formatNumber } from '../../../../ui/format/format';
import { TripPositionExplorer } from './trip-position-explorer';
import { karmaRecordMessages } from '../../record-details/karma-record-messages';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

/** Trip content shared by connected drawers; the host owns selection and the map context. */
@Component({
  selector: 'holita-trip-details',
  imports: [TripPositionExplorer],
  templateUrl: './trip-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '[attr.lang]': 'language()' },
})
export class TripDetails {
  readonly language = input.required<Language>();
  readonly trip = input.required<KarmaTripFieldsFragment>();
  readonly showMap = input(true);
  readonly provenance = input<SourceProvenance | null>(null);

  protected readonly text = computed(() => messages[this.language()]);
  protected readonly detailText = computed(() => karmaRecordMessages[this.language()]);
  protected readonly summaryText = computed(() => catalogs[this.language()]);
  protected readonly summaryMetrics = computed(() => {
    const row = this.trip();
    const text = this.summaryText();
    return [
      { label: text.distance, value: row.tripDistance, unit: text.units.distance },
      { label: text.nightDistance, value: row.tripDistanceNight, unit: text.units.distance },
      { label: text.duration, value: row.tripDuration, unit: text.units.duration },
      { label: text.maximumSpeed, value: row.maxSpeed, unit: text.units.speed },
      { label: text.startOdometer, value: row.startOdo, unit: text.units.odometer },
      { label: text.stopOdometer, value: row.stopOdo, unit: text.units.odometer },
    ];
  });
  protected readonly fields = computed(() => {
    const row = this.trip();
    return [
      { name: 'trip_id', value: row.id },
      { name: 'car_id', value: row.carId },
      { name: 'car_number', value: row.carNumber },
      { name: 'device_id', value: row.deviceId },
      { name: 'driver_id', value: row.driverId },
      { name: 'trip_active', value: row.tripActive },
      { name: 'start_message_id', value: row.startMessageId },
      { name: 'start_date', value: row.startDate },
      { name: 'start_latitude', value: row.startLatitude },
      { name: 'start_longitude', value: row.startLongitude },
      { name: 'start_odo', value: row.startOdo },
      { name: 'stop_message_id', value: row.stopMessageId },
      { name: 'stop_date', value: row.stopDate },
      { name: 'stop_latitude', value: row.stopLatitude },
      { name: 'stop_longitude', value: row.stopLongitude },
      { name: 'stop_odo', value: row.stopOdo },
      { name: 'trip_duration', value: row.tripDuration },
      { name: 'trip_distance', value: row.tripDistance },
      { name: 'trip_duration_night', value: row.tripDurationNight },
      { name: 'trip_distance_night', value: row.tripDistanceNight },
      { name: 'max_speed', value: row.maxSpeed },
      { name: 'driving_score', value: row.drivingScore },
      { name: 'eco_score', value: row.ecoScore },
    ];
  });

  protected raw(value: number | null | undefined): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
}
