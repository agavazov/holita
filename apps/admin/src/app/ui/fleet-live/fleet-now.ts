import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectFleetFormat } from '../format/fleet-format';
import { interpolate } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';
import { fleetLiveText, type FleetLiveDevice, type FleetLiveMode } from './fleet-live';

@Component({
  selector: 'holita-fleet-now',
  template: `
    <span class="live-cell">
      <span class="live-cell__text" [attr.title]="exact()">{{ activity() }}</span>
      @if (mode() === 'record') {
        @if (event(); as event) {
          <span class="app-muted">{{
            (language() === 'bg' ? event.nameBg : event.nameEn) ?? text().unknownEvent
          }}</span>
        }
      }
    </span>
  `,
  styleUrl: './fleet-live.scss',
  host: { '[attr.data-mode]': 'mode()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetNow {
  readonly device = input.required<FleetLiveDevice>();
  readonly mode = input<FleetLiveMode>('record');
  protected readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly event = computed(() => this.device()?.ermState?.latestEvent);
  protected readonly activity = computed(() => {
    const event = this.event(),
      text = this.text();
    if (!event) {
      return text.unknownActivity;
    }
    if (event.speedKmh !== null && event.speedKmh > 0) {
      return interpolate(text.driving, { speed: this.units.speed(event.speedKmh) });
    }
    if (event.ignitionOn === false) {
      return text.ignitionOff;
    }
    if (event.engineOn === true) {
      return text.engineRunning;
    }
    return event.speedKmh === 0 || event.engineOn === false ? text.parked : text.unknownActivity;
  });
  protected readonly exact = computed(() => this.units.dateTime(this.event()?.eventTime, true));
}
