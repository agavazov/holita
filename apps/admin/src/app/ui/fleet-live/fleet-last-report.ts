import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { injectFleetFormat } from '../format/fleet-format';
import { formatDateTime, formatRelative } from '../format/format';
import { UI_LANGUAGE } from '../ui-language';
import { type FleetLiveDevice } from './fleet-live';

@Component({
  selector: 'holita-fleet-last-report',
  template: `<time [attr.datetime]="timestamp()" [attr.title]="exact()">{{ relative() }}</time>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetLastReport {
  readonly device = input.required<FleetLiveDevice>();
  readonly reportedAt = input<string | null>(null);
  private readonly now = toSignal(interval(30_000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });
  private readonly language = inject(UI_LANGUAGE);
  private readonly units = injectFleetFormat();
  protected readonly timestamp = computed(
    () =>
      this.device()?.ermState?.lastFrameAt ?? this.device()?.lastReportedAt ?? this.reportedAt(),
  );
  protected readonly exact = computed(
    () =>
      formatDateTime(this.timestamp(), this.language(), this.units.preferences().timeZone, true) +
      ' · ' +
      this.units.preferences().timeZone,
  );
  protected readonly relative = computed(() => {
    this.device();
    return formatRelative(this.timestamp(), this.now(), this.language());
  });
}
