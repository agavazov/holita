import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { FleetFaultSystem } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { FaultIcon } from './fault-icon';
import { faultSystems, faultsText, litSystems, type FleetFaultFinding } from './fault-wording';

type LampTone = 'danger' | 'warn' | 'info' | 'off' | 'unknown';

/**
 * The fault lamps of a truck as a dashboard: one telltale per system, lit in the colour of its
 * worst current finding. Null findings mean the truck has not been checked yet.
 */
@Component({
  selector: 'discocan-fault-cluster',
  imports: [FaultIcon],
  template: `
    <ul class="fault-cluster" [attr.aria-label]="text().cluster">
      @for (lamp of lamps(); track lamp.system) {
        <li>
          <button
            type="button"
            class="fault-lamp"
            [attr.data-tone]="lamp.tone"
            [attr.aria-pressed]="selected() === lamp.system"
            [attr.aria-label]="lamp.label"
            [title]="lamp.label"
            (click)="selected.set(selected() === lamp.system ? null : lamp.system)"
          >
            <discocan-fault-icon class="fault-lamp__icon" [system]="lamp.system" />
            <span class="fault-lamp__name">{{ lamp.name }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styleUrl: './fault-cluster.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaultCluster {
  readonly findings = input.required<
    readonly Pick<FleetFaultFinding, 'system' | 'severity'>[] | null
  >();
  readonly language = input.required<Language>();
  /** The system whose findings the page shows; a second click shows all systems again. */
  readonly selected = model<FleetFaultSystem | null>(null);

  protected readonly text = computed(() => faultsText(this.language()));
  protected readonly lamps = computed(() => {
    const findings = this.findings();
    const lit = new Map(litSystems(findings ?? []).map((item) => [item.system, item.severity]));
    return faultSystems.map((system) => {
      const severity = lit.get(system);
      const tone: LampTone =
        findings === null
          ? 'unknown'
          : severity === 'CRITICAL'
            ? 'danger'
            : severity === 'WARNING'
              ? 'warn'
              : severity === 'INFO'
                ? 'info'
                : 'off';
      const name = this.text().lampNames[system];
      return { system, tone, name, label: `${name}: ${this.text().lampStates[tone]}` };
    });
  });
}
