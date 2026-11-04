import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../tones';
import { toneSeverity } from '../tones';
import { UI_LANGUAGE } from '../ui-language';
import { fleetLiveText, type FleetLiveDevice } from './fleet-live';

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
    if (device.ermState?.health.overdue) {
      return { label: text.overdue, tone: 'warn' };
    }
    if (device.ermState?.lastFrameAt) {
      return { label: text.reporting, tone: 'info' };
    }
    return { label: text.never, tone: 'neutral' };
  });
}
