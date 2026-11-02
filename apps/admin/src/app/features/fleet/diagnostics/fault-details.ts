import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, type UrlTree } from '@angular/router';
import { Tag } from 'primeng/tag';
import type {
  FleetScenarioFaultDetailsFragment,
  FleetScenarioLogDetailsFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { SourceContext } from '../../../ui/source-context/source-context';
import { toneSeverity, type StatusTone } from '../../../ui/tones';
import bg from './fault-details.bg.json';
import en from './fault-details.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };
const severityTones: Record<FleetScenarioFaultDetailsFragment['severity'], StatusTone> = {
  INFO: 'info',
  WARNING: 'warn',
  CRITICAL: 'danger',
};
const statusTones: Record<FleetScenarioFaultDetailsFragment['reportedStatus'], StatusTone> = {
  ACTIVE: 'warn',
  RESOLVED: 'neutral',
};

@Component({
  selector: 'holita-fault-details',
  imports: [SourceContext, Tag, RouterLink],
  templateUrl: './fault-details.html',
  styleUrl: './fault-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-stack', '[attr.lang]': 'language()' },
})
export class FaultDetails {
  readonly fault = input.required<FleetScenarioFaultDetailsFragment>();
  readonly observations = input.required<readonly FleetScenarioLogDetailsFragment[]>();
  readonly vehicleLabel = input.required<string>();
  readonly exampleClock = input.required<string>();
  readonly timeZone = input.required<string>();
  readonly language = input.required<Language>();
  readonly logLink = input.required<(id: string) => UrlTree>();

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly severity = computed(() => toneSeverity(severityTones[this.fault().severity]));
  protected readonly occurrences = computed(() =>
    formatNumber(this.fault().occurrences, this.language()),
  );

  protected statusSeverity(status: FleetScenarioFaultDetailsFragment['reportedStatus']) {
    return toneSeverity(statusTones[status]);
  }

  protected time(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.timeZone(), true);
  }
}
