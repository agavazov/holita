import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import type { AdminLiveVehicleQuery } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import {
  warningLampLabel,
  warningStateLabel,
  warningTone,
} from '../../../ui/fleet-live/fault-wording';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatDuration, formatNumber, formatRelative } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { locationMap } from '../../../ui/map-preview/location-map';
import { toneSeverity } from '../../../ui/tones';
import {
  problemSeverityTones,
  problemsText,
  problemTitle,
} from '../overview/problems-presentation';
import {
  speedBand,
  trailWindows,
  type LiveTruck,
  type TrailPoint,
  type TrailWindow,
} from './live-dashboard-model';
import { liveDashboardText } from './live-dashboard-text';

@Component({
  selector: 'discocan-live-truck-details',
  imports: [
    FormsModule,
    RouterLink,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    ButtonDirective,
    Message,
    SelectButton,
    Tag,
  ],
  templateUrl: './live-truck-details.html',
  styleUrl: './live-truck-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTruckDetails {
  readonly language = input.required<Language>();
  readonly branchId = input.required<string>();
  readonly truck = input.required<LiveTruck>();
  readonly detail = input<AdminLiveVehicleQuery | null>(null);
  readonly detailError = input<string | null>(null);
  readonly trail = input<readonly TrailPoint[]>([]);
  readonly trailError = input<string | null>(null);
  readonly trailTruncated = input(false);
  readonly limitKph = input.required<number>();
  readonly now = input.required<number>();
  readonly window = model<TrailWindow>('day');
  readonly closed = output();

  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => liveDashboardText(this.language()));
  protected readonly sections = ['status', 'position', 'trail'];
  protected readonly windowOptions = computed(() =>
    trailWindows.map((value) => ({ value, label: this.text().windows[value] })),
  );
  protected readonly vehicle = computed(() => this.detail()?.fleetVehicle ?? null);
  protected readonly device = computed(() => this.vehicle()?.devices[0] ?? null);
  protected readonly lamps = computed(() =>
    (this.vehicle()?.currentWarnings ?? []).filter(
      (lamp) => lamp.state === 'RED' || lamp.state === 'YELLOW',
    ),
  );
  protected readonly problems = computed(() =>
    (this.detail()?.fleetProblems.items ?? []).filter((problem) => problem.requiringAttention),
  );
  protected readonly fleet = computed(() => ['/', this.language(), this.branchId(), 'fleet']);
  /** The newest report: the trail is fresher than the fleet snapshot while a truck drives. */
  protected readonly latest = computed(() => {
    const point = this.trail().at(-1);
    const truck = this.truck();
    return point && (!truck.positionAt || point.recordedAt >= truck.positionAt)
      ? {
          at: point.recordedAt,
          speedKph: point.speedKph ?? null,
          odometerKm: point.odometerKm ?? truck.odometerKm,
          ignition: point.ignition ?? truck.ignition,
        }
      : {
          at: truck.positionAt,
          speedKph: truck.speedKph,
          odometerKm: truck.odometerKm,
          ignition: truck.ignition,
        };
  });
  protected readonly trailStats = computed(() => {
    const points = this.trail();
    const odometers = points
      .map((point) => point.odometerKm)
      .filter((value): value is number => value !== null);
    const speeds = points
      .map((point) => point.speedKph)
      .filter((value): value is number => value !== null);
    const first = odometers[0];
    const last = odometers.at(-1);
    return {
      points: points.length,
      distanceKm: first !== undefined && last !== undefined && last >= first ? last - first : null,
      maxSpeedKph: speeds.length ? Math.max(...speeds) : null,
      overLimit: speeds.filter((speed) => speedBand(speed, this.limitKph()) !== 'normal').length,
    };
  });

  protected relative(iso: string | null | undefined): string {
    return formatRelative(iso, this.now(), this.language());
  }

  protected number(value: number | null | undefined, unit = '', fraction = 0): string {
    const text = formatNumber(value ?? null, this.language(), { fraction });
    return value === null || value === undefined || !unit ? text : `${text}\u00a0${unit}`;
  }

  protected duration(seconds: number | null | undefined): string {
    return formatDuration(seconds, this.language());
  }

  protected coordinates(truck: LiveTruck): string {
    return truck.position
      ? `${this.number(truck.position.latitude, '', 5)}, ${this.number(truck.position.longitude, '', 5)}`
      : this.text().noPosition;
  }

  protected googleUrl(truck: LiveTruck): string | null {
    return locationMap(truck.position?.latitude, truck.position?.longitude);
  }

  protected title(problem: AdminLiveVehicleQuery['fleetProblems']['items'][number]): string {
    return problemTitle(problem, this.language());
  }

  protected severity(problem: AdminLiveVehicleQuery['fleetProblems']['items'][number]) {
    return {
      label: problemsText(this.language()).severities[problem.severity],
      severity: toneSeverity(problemSeverityTones[problem.severity]),
    };
  }

  protected lampLabel(parameterId: number): string {
    return warningLampLabel(parameterId, this.language());
  }

  protected lampState(
    state: AdminLiveVehicleQuery['fleetVehicle']['currentWarnings'][number]['state'],
  ) {
    return {
      label: warningStateLabel(state, this.language()),
      severity: toneSeverity(warningTone(state)),
    };
  }

  protected eventName(): string | null {
    const event = this.device()?.ermState?.latestEvent;
    return (this.language() === 'bg' ? event?.nameBg : event?.nameEn) ?? null;
  }

  protected heading(): string {
    return interpolate(this.text().details, { plate: this.truck().plate });
  }
}
