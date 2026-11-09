import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormatNumberPipe } from '../format/format.pipes';
import { KpiStrip } from '../kpi/kpi-strip';
import { KpiTile } from '../kpi/kpi-tile';
import { UI_LANGUAGE } from '../ui-language';
import { fleetLiveText, hasFleetFaults, type FleetLiveDevice } from './fleet-live';

@Component({
  selector: 'discocan-fleet-live-summary',
  imports: [KpiStrip, KpiTile, FormatNumberPipe],
  template: `
    <discocan-kpi-strip [label]="text().summary" [loading]="loading()">
      <discocan-kpi-tile
        [label]="text().online"
        [value]="counts().online | discocanNumber"
        tone="success"
      />
      <discocan-kpi-tile
        [label]="text().overdue"
        [value]="counts().overdue | discocanNumber"
        tone="warn"
      />
      <discocan-kpi-tile
        [label]="text().backup"
        [value]="counts().backup | discocanNumber"
        tone="warn"
      />
      <discocan-kpi-tile
        [label]="text().withFaults"
        [value]="counts().faults | discocanNumber"
        tone="danger"
      />
      <discocan-kpi-tile
        [label]="unassigned() === 'vehicles' ? text().withoutDevice : text().unassigned"
        [value]="counts().unassigned | discocanNumber"
        tone="neutral"
      />
    </discocan-kpi-strip>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class FleetLiveSummary {
  readonly devices = input.required<readonly FleetLiveDevice[]>();
  readonly loading = input(false);
  readonly unassigned = input<'devices' | 'vehicles'>('devices');
  readonly groups = input<readonly (readonly FleetLiveDevice[])[] | null>(null);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly counts = computed(() => {
    const groups = this.groups() ?? this.devices().map((device) => [device]);
    const available = groups.every((group) => group.every((device) => device !== undefined));
    return {
      online: available
        ? groups.filter((group) => group.some((device) => device?.ermState?.online)).length
        : null,
      overdue: available
        ? groups.filter((group) => group.some((device) => device?.ermState?.health.overdue)).length
        : null,
      backup: available
        ? groups.filter((group) => group.some((device) => device?.routing === 'KARMA_BACKUP'))
            .length
        : null,
      faults: available ? groups.filter((group) => group.some(hasFleetFaults)).length : null,
      unassigned: available
        ? groups.filter((group) =>
            this.unassigned() === 'vehicles'
              ? group.length === 0 || group.every((device) => device === null)
              : group.some((device) => !!device && !device.vehicleId),
          ).length
        : null,
    };
  });
}
