import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { interpolate } from '@osnova/ui';
import type {
  AdminControlCenterEventsQuery,
  AdminControlCenterFramesQuery,
  AdminErmSessionEvidenceFragment,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { controlCenterText } from '../control-center/control-center-text';
import { ermText } from './erm-text';

type Frame = AdminControlCenterFramesQuery['fleetDevice']['messages']['items'][number];
type Event = AdminControlCenterEventsQuery['fleetDevice']['events']['items'][number];
type RoutingWrite = NonNullable<
  NonNullable<AdminErmSessionEvidenceFragment['erm']>['latestKarmaRoutingWrite']
>;

export function ermFrameConfirmation(frame: Frame, language: Language): string | null {
  const acknowledgement = frame.acknowledgement;
  return acknowledgement?.erm
    ? interpolate(controlCenterText[language].detail.confirmation, {
        reference: acknowledgement.erm.commandReference,
        result: acknowledgement.resultCode,
      })
    : null;
}

@Component({
  selector: 'discocan-erm-frame-evidence',
  imports: [RouterLink],
  templateUrl: './frame-evidence.html',
  styleUrl: '../control-center/control-center.css',
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErmFrameEvidence {
  readonly frame = input.required<Frame>();
  readonly commandsLink = input.required<string[]>();
  readonly language = input.required<Language>();
  readonly followRequest = output();
  protected readonly erm = computed(() => ermText[this.language()]);
  protected readonly text = computed(() => controlCenterText[this.language()]);
}

@Component({
  selector: 'discocan-erm-event-evidence',
  imports: [JsonPipe],
  templateUrl: './event-evidence.html',
  styleUrl: '../control-center/control-center.css',
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErmEventEvidence {
  readonly event = input.required<Event>();
  readonly language = input.required<Language>();
  protected readonly text = computed(() => controlCenterText[this.language()]);
}

@Component({
  selector: 'discocan-erm-routing-write',
  template: `
    <h3>{{ text().latestRouteWrite }}</h3>
    <time [title]="format.utc(write().receivedAt)">{{
      format.dateTime(write().receivedAt, true)
    }}</time>
    <pre class="control-center__frame">{{ write().displayText }}</pre>
  `,
  styleUrl: '../control-center/control-center.css',
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErmRoutingWrite {
  readonly write = input.required<RoutingWrite>();
  readonly language = input.required<Language>();
  protected readonly text = computed(() => ermText[this.language()]);
  protected readonly format = injectFleetFormat();
}
