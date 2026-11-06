import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { injectFleetFormat } from '../format/fleet-format';
import { formatRelative } from '../format/format';
import { UI_LANGUAGE } from '../ui-language';
import { fleetLiveText, type FleetLiveDevice, type FleetLiveMode } from './fleet-live';

@Component({
  selector: 'holita-fleet-last-report',
  template: `
    <span class="live-cell">
      <span class="live-cell__text" [attr.title]="exact()">
        @if (kind() === 'position') {
          {{ text().positionAge }} ·
        }
        <time [attr.datetime]="timestamp()">{{ relative() }}</time>
      </span>
    </span>
  `,
  styleUrl: './fleet-live.scss',
  host: { '[attr.data-mode]': 'mode()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetLastReport {
  readonly device = input.required<FleetLiveDevice>();
  readonly reportedAt = input<string | null>(null);
  readonly mode = input<FleetLiveMode>('record');
  /** Position age uses only the explicitly supplied position timestamp, never frame freshness. */
  readonly kind = input<'report' | 'position'>('report');
  private readonly now = toSignal(interval(30_000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });
  private readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  protected readonly text = computed(() => fleetLiveText(this.language()));
  protected readonly timestamp = computed(() =>
    this.kind() === 'position'
      ? this.reportedAt()
      : (this.device()?.ermState?.lastFrameAt ??
        this.device()?.lastReportedAt ??
        this.reportedAt()),
  );
  protected readonly exact = computed(
    () => this.units.dateTime(this.timestamp(), true) + ' · ' + this.units.preferences().timeZone,
  );
  protected readonly relative = computed(() => {
    this.device();
    return formatRelative(this.timestamp(), this.now(), this.language());
  });
}
