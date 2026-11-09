import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExternalLink } from '@primeicons/angular/external-link';
import { Tag } from 'primeng/tag';
import { injectFleetFormat } from '../format/fleet-format';
import { formatNumber } from '../format/format';
import { interpolate } from '../i18n/messages';
import { toneSeverity, type StatusTone } from '../tones';
import { UI_LANGUAGE } from '../ui-language';
import { faultsText, warningLampLabel, warningStateLabel } from './fault-wording';
import { fleetLiveText, type FleetLiveDevice, type FleetLiveMode } from './fleet-live';

@Component({
  selector: 'discocan-fleet-faults',
  imports: [RouterLink, ExternalLink, Tag],
  template: `
    <span class="live-cell">
      <span class="live-cell__text" [attr.title]="warningTitle()">
        @if (summary(); as summary) {
          <p-tag [value]="summary" [severity]="toneSeverity(tone())" />
        } @else {
          <span class="app-muted">—</span>
        }
      </span>
      @if (link(); as link) {
        <a
          class="app-icon-button"
          [routerLink]="link"
          [attr.aria-label]="text().diagnostics"
          [attr.title]="text().diagnostics"
        >
          <svg data-p-icon="external-link" aria-hidden="true"></svg>
        </a>
      }
    </span>
  `,
  styleUrl: './fleet-live.scss',
  host: { '[attr.data-mode]': 'mode()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetFaults {
  readonly device = input.required<FleetLiveDevice>();
  readonly mode = input<FleetLiveMode>('record');
  readonly link = input<readonly string[] | null>(null);
  private readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly toneSeverity = toneSeverity;
  protected readonly summary = computed(() => {
    const warnings = this.device()?.currentWarnings;
    return warnings?.length
      ? interpolate(faultsText(this.language()).currentCount, {
          count: formatNumber(warnings.length, this.language()),
        })
      : null;
  });
  protected readonly tone = computed<StatusTone>(() => {
    const warnings = this.device()?.currentWarnings ?? [];
    return warnings.some((warning) => warning.state === 'RED')
      ? 'danger'
      : warnings.some((warning) => warning.state === 'YELLOW')
        ? 'warn'
        : 'info';
  });
  protected readonly warningTitle = computed(() => {
    const device = this.device();
    if (!device) {
      return device === null ? this.text().noDevice : this.text().unavailable;
    }
    return device.currentWarnings.length
      ? device.currentWarnings
          .map((warning) =>
            [
              warningLampLabel(warning.parameterId, this.language()),
              warningStateLabel(warning.state, this.language()),
              this.units.dateTime(warning.stateSince),
            ].join(' · '),
          )
          .join('; ')
      : faultsText(this.language()).noCurrentWarnings;
  });
}
