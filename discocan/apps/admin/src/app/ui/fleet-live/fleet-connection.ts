import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '@osnova/ui';
import { toneSeverity } from '@osnova/ui';
import { UI_LANGUAGE } from '@osnova/ui';
import {
  fleetCloseReason,
  fleetLiveText,
  type FleetLiveDevice,
  type FleetLiveMode,
} from './fleet-live';
import { injectFleetFormat } from '../format/fleet-format';
import { formatDuration } from '@osnova/ui';
import { interpolate } from '@osnova/ui';
import { karmaBackup } from '../../features/erm/karma-connection';
import { ermText } from '../../features/erm/erm-text';

@Component({
  selector: 'discocan-fleet-connection',
  imports: [Tag],
  template: `
    <span class="live-cell">
      <span class="app-inline">
        <p-tag [value]="status().label" [severity]="toneSeverity(status().tone)" />
        @if (mode() === 'record') {
          @if (backup()) {
            <p-tag [value]="karmaText().backup" [severity]="toneSeverity('warn')" />
          }
          @if (device()?.state?.connected && device()?.state?.health?.overdue) {
            <p-tag [value]="text().overdue" [severity]="toneSeverity('warn')" />
          }
        }
      </span>
      @if (mode() === 'table') {
        <span class="live-cell__text app-muted" [attr.title]="reason()">{{ shortReason() }}</span>
      } @else {
        @if (reason()) {
          <span class="app-muted">{{ reason() }}</span>
        }
        @if (device() && !device()?.vehicleId) {
          <span class="app-muted">{{ text().unassigned }}</span>
        }
      }
    </span>
  `,
  styleUrl: './fleet-live.scss',
  host: { '[attr.data-mode]': 'mode()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetConnection {
  readonly device = input.required<FleetLiveDevice>();
  readonly mode = input<FleetLiveMode>('record');
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly karmaText = computed(() => ermText[this.language()].connection);
  protected readonly backup = computed(() => karmaBackup(this.device()));
  private readonly units = injectFleetFormat();
  protected readonly reason = computed(() => {
    const device = this.device(),
      state = device?.state,
      text = this.text();
    const backupSince = this.backup()?.routingHealth?.backupSince;
    if (backupSince) {
      return interpolate(this.karmaText().backupSince, {
        time: this.units.dateTime(backupSince),
      });
    }
    if (!state) {
      return null;
    }
    if (state.health.overdue && state.health.lastReportAgeSeconds !== null) {
      return interpolate(text.gap, {
        duration: formatDuration(state.health.lastReportAgeSeconds, this.language()),
      });
    }
    if (state.connected) {
      return null;
    }
    const event = state.latestEvent;
    if (
      state.lastReportAt &&
      (event?.ignition === false || (event?.engineOn === false && (event.speedKph ?? 0) === 0))
    ) {
      const next = new Date(
        Date.parse(state.lastReportAt) + state.health.expectedIntervalSeconds * 1000,
      ).toISOString();
      return interpolate(text.parkedNext, { time: this.units.time(next) });
    }
    return state.health.lastCloseReason
      ? fleetCloseReason(state.health.lastCloseReason, this.language())
      : null;
  });
  protected readonly shortReason = computed(() => {
    const device = this.device(),
      text = this.text();
    if (this.backup()) {
      return this.karmaText().backup;
    }
    if (device?.state?.health.overdue) {
      return this.reason();
    }
    return device && !device.vehicleId ? text.unassigned : null;
  });
  protected readonly toneSeverity = toneSeverity;
  protected readonly status = computed<{ label: string; tone: StatusTone }>(() => {
    const device = this.device(),
      text = this.text();
    if (device === null) {
      return { label: text.noDevice, tone: 'neutral' };
    }
    if (!device) {
      return { label: text.unavailable, tone: 'neutral' };
    }
    if (device.state?.connected) {
      return device.state.lastReportAt && !device.state.health.overdue
        ? { label: text.live, tone: 'success' }
        : { label: text.connected, tone: 'info' };
    }
    if (device.state?.lastReportAt && device.state.health.overdue) {
      return { label: text.overdue, tone: 'warn' };
    }
    if (device.state?.lastReportAt) {
      return { label: text.reporting, tone: 'info' };
    }
    return { label: text.never, tone: 'neutral' };
  });
}
