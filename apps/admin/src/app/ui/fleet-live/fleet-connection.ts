import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../tones';
import { toneSeverity } from '../tones';
import { UI_LANGUAGE } from '../ui-language';
import { fleetCloseReason, fleetLiveText, type FleetLiveDevice } from './fleet-live';
import { injectFleetFormat } from '../format/fleet-format';
import { formatDateTime, formatDuration, formatTime } from '../format/format';
import { interpolate } from '../i18n/messages';

@Component({
  selector: 'holita-fleet-connection',
  imports: [Tag],
  template: `
    <span class="app-cell-stack">
      <span class="app-inline">
        <p-tag [value]="status().label" [severity]="toneSeverity(status().tone)" />
        @if (device()?.routing === 'KARMA_BACKUP') {
          <p-tag [value]="text().backup" [severity]="toneSeverity('warn')" />
        }
        @if (device()?.ermState?.online && device()?.ermState?.health?.overdue) {
          <p-tag [value]="text().overdue" [severity]="toneSeverity('warn')" />
        }
      </span>
      @if (reason()) {
        <span class="app-muted">{{ reason() }}</span>
      }
      @if (device() && !device()?.vehicleId) {
        <span class="app-muted">{{ text().unassigned }}</span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetConnection {
  readonly device = input.required<FleetLiveDevice>();
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => fleetLiveText(this.language()));
  private readonly units = injectFleetFormat();
  protected readonly reason = computed(() => {
    const device = this.device(),
      state = device?.ermState,
      text = this.text();
    const zone = this.units.preferences().timeZone;
    if (device?.routing === 'KARMA_BACKUP' && device.routingHealth?.backupSince) {
      return interpolate(text.backupSince, {
        time: formatDateTime(device.routingHealth.backupSince, this.language(), zone),
      });
    }
    if (!state || state.online) {
      return null;
    }
    if (state.health.overdue && state.health.lastFrameAgeSeconds !== null) {
      return interpolate(text.gap, {
        duration: formatDuration(state.health.lastFrameAgeSeconds, this.language()),
      });
    }
    const event = state.latestEvent;
    if (
      state.lastFrameAt &&
      (event?.ignitionOn === false || (event?.engineOn === false && (event.speedKmh ?? 0) === 0))
    ) {
      const next = new Date(
        Date.parse(state.lastFrameAt) + state.health.expectedIntervalSeconds * 1000,
      ).toISOString();
      return interpolate(text.parkedNext, { time: formatTime(next, this.language(), zone) });
    }
    return state.health.lastCloseReason
      ? fleetCloseReason(state.health.lastCloseReason, this.language())
      : null;
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
    if (device.ermState?.online) {
      return { label: text.online, tone: 'success' };
    }
    if (device.ermState?.lastFrameAt && device.ermState.health.overdue) {
      return { label: text.overdue, tone: 'warn' };
    }
    if (device.ermState?.lastFrameAt) {
      return { label: text.reporting, tone: 'info' };
    }
    return { label: text.never, tone: 'neutral' };
  });
}
