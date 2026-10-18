import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Timeline } from 'primeng/timeline';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import {
  displayTimeZone,
  FormatDateTimePipe,
  FormatDurationPipe,
  FormatNumberPipe,
} from '../../../ui/format/format.pipes';
import { formatDateTime } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
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
    ButtonDirective,
    Timeline,
    RouteDrawer,
    FormatDateTimePipe,
    FormatDurationPipe,
    FormatNumberPipe,
  ],
  templateUrl: './trip-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDrawer {
  readonly trip = input.required<TripRow>();
  readonly closed = output();
  readonly openVehicle = output<string>();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => tripsText(this.language()).drawer);
  protected readonly title = computed(() =>
    interpolate(this.text().title, { plate: this.trip().plate }),
  );
  protected readonly subtitle = computed(() => {
    const trip = this.trip();
    return `${formatDateTime(trip.startedAt, this.language(), displayTimeZone)} · ${trip.from} → ${trip.to}`;
  });
  protected readonly timeline = computed<readonly TimelineEntry[]>(() => {
    const trip = this.trip();
    const text = this.text();
    return [
      {
        at: trip.startedAt,
        title: interpolate(text.departed, { place: trip.from }),
        detail: null,
        tone: 'neutral',
      },
      ...trip.events.map((event) => ({
        at: event.at,
        title: event.kind,
        detail: event.detail,
        tone: event.tone,
      })),
      {
        at: trip.endedAt,
        title: interpolate(text.arrived, { place: trip.to }),
        detail: null,
        tone: 'neutral',
      },
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
}
