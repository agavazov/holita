import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Language } from '../../i18n/messages';
import { faultsText, warningLampLabel, type FleetWarning } from './fault-wording';

@Component({
  selector: 'discocan-fleet-fault-coverage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="app-card" [attr.aria-label]="text().coverage">
      <h2 class="app-card__title">{{ text().coverage }}</h2>
      <p class="app-muted">{{ text().coverageHint }}</p>
      @if (missing().length) {
        <dl class="app-facts">
          @for (lamp of missing(); track lamp.deviceId + ':' + lamp.parameterId) {
            <div>
              <dt>{{ lampLabel(lamp.parameterId) }}</dt>
              <dd>{{ text().noLampValue }}</dd>
            </div>
          }
        </dl>
      } @else {
        <p>{{ lamps().length ? text().lampValuesReceived : text().noLamps }}</p>
      }
      @if (hasFaultReports() === false) {
        <p>{{ text().noFaultReports }}</p>
      }
    </section>
  `,
})
export class FleetFaultCoverage {
  readonly lamps = input.required<readonly FleetWarning[]>();
  readonly language = input.required<Language>();
  readonly hasFaultReports = input<boolean | null>(null);
  protected readonly text = computed(() => faultsText(this.language()));
  protected readonly missing = computed(() =>
    this.lamps().filter((lamp) => lamp.state === 'UNKNOWN'),
  );
  protected lampLabel(parameterId: number): string {
    return warningLampLabel(parameterId, this.language());
  }
}
