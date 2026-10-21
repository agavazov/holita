import { RouterLink } from '@angular/router';
import type { FleetRecordLinks } from '../fleet-record-links';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Timeline } from 'primeng/timeline';
import { Tag } from 'primeng/tag';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormatDateTimePipe, FormatDurationPipe } from '../../../ui/format/format.pipes';
import { formatDateTime } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { scoreTone } from '../drivers/drivers-view';
import { tripsText } from './i18n/messages';
import type { TripRow } from './trips-view';

interface TimelineEntry {
  readonly at: string;
  readonly title: string;
  readonly detail: string | null;
  readonly tone: string;
}

/**
 * A read-only drawer: the trip summary and its timeline from departure to arrival. Records that
 * nobody edits (trips, log entries) use this view mode.
 */
@Component({
  selector: 'holita-trip-drawer',
  imports: [
    RouterLink,
    ButtonDirective,
    Timeline,
    Tag,
    RouteDrawer,
    FormatDateTimePipe,
    FormatDurationPipe,
  ],
  templateUrl: './trip-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDrawer {
  readonly recordLinks = input<FleetRecordLinks | null>(null);
  readonly trip = input<TripRow | null>(null);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  readonly retry = output();
  readonly closed = output();
  readonly openVehicle = output<string>();

  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly drawer = viewChild.required(RouteDrawer);
  protected readonly text = computed(() => tripsText(this.language()).drawer);
  protected readonly title = computed(() =>
    this.trip()
      ? interpolate(this.text().title, { plate: this.trip()?.plate ?? '' })
      : this.text().recordTitle,
  );
  protected readonly subtitle = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return null;
    }
    return `${formatDateTime(trip.startedAt, this.language(), this.units.preferences().timeZone)} · ${trip.from ?? '—'} → ${trip.to ?? '—'}`;
  });
  protected readonly timeline = computed<readonly TimelineEntry[]>(() => {
    const trip = this.trip();
    if (!trip) {
      return [];
    }
    const text = this.text();
    return [
      {
        at: trip.startedAt,
        title:
          trip.from === null
            ? text.departedUnknown
            : interpolate(text.departed, { place: trip.from }),
        detail: null,
        tone: 'neutral',
      },
      ...[...trip.events]
        .sort((first, second) => first.at.localeCompare(second.at))
        .map((event) => ({
          at: event.at,
          title: event.kind,
          detail: event.detail,
          tone: event.tone,
        })),
      ...(trip.endedAt === null
        ? []
        : [
            {
              at: trip.endedAt,
              title:
                trip.to === null
                  ? text.arrivedUnknown
                  : interpolate(text.arrived, { place: trip.to }),
              detail: null,
              tone: 'neutral',
            },
          ]),
    ];
  });
  /** p-timeline takes a mutable array. */
  protected readonly entries = computed(() => [...this.timeline()]);

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  protected dotClass(entry: TimelineEntry): string {
    return `app-dot app-dot--${entry.tone}`;
  }

  protected close(): void {
    this.drawer().close();
  }
}
