import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExternalLink } from '@primeicons/angular/external-link';
import { Tag } from 'primeng/tag';
import { injectFleetFormat } from '../format/fleet-format';
import { formatDateTime, formatNumber } from '../format/format';
import { interpolate } from '../i18n/messages';
import { toneSeverity, type StatusTone } from '../tones';
import { UI_LANGUAGE } from '../ui-language';
import { fleetLiveText, type FleetLiveDevice, type FleetLiveMode } from './fleet-live';

@Component({
  selector: 'holita-fleet-faults',
  imports: [RouterLink, ExternalLink, Tag],
  template: `
    @if (mode() === 'table') {
      <span class="live-cell">
        <span class="live-cell__text" [attr.title]="compactTitle()">
          @if (compactSummary(); as summary) {
            <p-tag [value]="summary" [severity]="toneSeverity(compactTone())" />
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
    } @else {
      <span class="faults">
        <span class="fault-values">
          @if (device()?.ermState; as state) {
            @if (state.alarmsLast24h > 0) {
              <p-tag [value]="alarmCount()" [severity]="toneSeverity(alarmTone(state))" />
              @if (state.latestAlarm; as alarm) {
                <span class="app-muted" [attr.title]="date(alarm.eventTime)">{{
                  (language() === 'bg' ? alarm.nameBg : alarm.nameEn) ?? text().unknownEvent
                }}</span>
              }
            } @else {
              <span class="app-muted">—</span>
            }
          } @else {
            <span class="app-muted">—</span>
          }
          @if (device()?.diagnostics.count) {
            <p-tag
              [value]="recorded()"
              [severity]="toneSeverity('danger')"
              [attr.title]="faultTitle()"
            />
          }
        </span>
        @if (link(); as link) {
          <a
            class="app-icon-button"
            [routerLink]="link"
            [attr.aria-label]="text().diagnostics"
            [attr.title]="text().diagnostics"
            ><svg data-p-icon="external-link" aria-hidden="true"></svg
          ></a>
        }
      </span>
    }
  `,
  styleUrl: './fleet-live.scss',
  host: { '[attr.data-mode]': 'mode()' },
  styles: `
    :host {
      display: block;
      white-space: normal;
    }
    .faults {
      display: flex;
      align-items: start;
      gap: var(--p-app-space-1);
    }
    .fault-values {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--p-app-space-1);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetFaults {
  readonly device = input.required<FleetLiveDevice>();
  readonly mode = input<FleetLiveMode>('record');
  readonly link = input<readonly string[] | null>(null);
  protected readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly toneSeverity = toneSeverity;
  protected readonly alarmCount = computed(() =>
    interpolate(this.text().alarms, {
      count: formatNumber(this.device()?.ermState?.alarmsLast24h, this.language()),
    }),
  );
  protected readonly recorded = computed(() =>
    interpolate(this.text().recordedFaults, {
      count: formatNumber(this.device()?.diagnostics.count, this.language()),
    }),
  );
  protected readonly compactSummary = computed(() => {
    const device = this.device();
    const values: string[] = [];
    if (device?.ermState?.alarmsLast24h) {
      values.push(
        interpolate(this.text().alarmsShort, {
          count: formatNumber(device.ermState.alarmsLast24h, this.language()),
        }),
      );
    }
    if (device?.diagnostics.count) {
      values.push(this.recorded());
    }
    return values.join(' · ');
  });
  protected readonly compactTone = computed<StatusTone>(() => {
    if (this.device()?.diagnostics.count) {
      return 'danger';
    }
    const state = this.device()?.ermState;
    return state ? this.alarmTone(state) : 'neutral';
  });
  protected readonly compactTitle = computed(() => {
    const device = this.device();
    if (device === undefined) {
      return this.text().unavailable;
    }
    return [this.compactSummary(), this.faultTitle()].filter(Boolean).join(' · ');
  });
  protected readonly faultTitle = computed(() => {
    const fault = this.device()?.diagnostics.latest;
    return fault
      ? `${fault.troubleCode ?? this.faultLabel(fault.kind)} · ${this.date(fault.occurredAt)} · ${fault.source}${fault.details ? ' · ' + fault.details : ''}`
      : null;
  });
  /** Critical alarms are red; WARNING diagnostic reports (event 02) stay amber. */
  protected alarmTone(state: {
    alarmsLast24h: number;
    latestAlarm: { severity: string } | null;
  }): StatusTone {
    if (!state.alarmsLast24h) {
      return 'neutral';
    }
    return state.latestAlarm?.severity === 'CRITICAL' ? 'danger' : 'warn';
  }
  protected faultLabel(kind: string): string {
    const labels: Readonly<Record<string, string>> = this.text().kinds;
    return labels[kind] ?? this.text().unknownEvent;
  }
  protected date(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.units.preferences().timeZone, true);
  }
}
