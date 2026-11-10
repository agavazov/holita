import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CheckCircle } from '@primeicons/angular/check-circle';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Tag } from 'primeng/tag';
import type { FleetFaultSystem } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { injectFleetFormat } from '../format/fleet-format';
import { formatRelative } from '../format/format';
import { interpolate } from '../i18n/messages';
import { toneSeverity, type StatusTone } from '../tones';
import { FaultCluster } from './fault-cluster';
import { FaultIcon } from './fault-icon';
import {
  faultFmi,
  faultsText,
  findingCode,
  findingTitle,
  latestFaultRead,
  severityTone,
  withCurrentLamps,
  worstSeverity,
  type FleetFaultCheck,
  type FleetFaultFinding,
  type FleetFaultRead,
  type FleetWarning,
} from './fault-wording';

const STALE_AFTER = 24 * 3_600_000;

/**
 * A truck's current faults as a scanner shows them: a verdict, the fault lamps and one card per
 * fault. It reads the server's 15-minute check and the latest scheduled read from the truck.
 */
@Component({
  selector: 'discocan-fault-scanner',
  imports: [CheckCircle, ExclamationTriangle, FaultCluster, FaultIcon, Tag],
  templateUrl: './fault-scanner.html',
  styleUrl: './fault-scanner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaultScanner {
  readonly check = input.required<FleetFaultCheck | null | undefined>();
  /** Lamps reported since the check; they replace the check's lamp findings when given. */
  readonly lamps = input<readonly FleetWarning[] | null>(null);
  /** The device's command requests; the newest fault-logger read is shown. */
  readonly reads = input<readonly FleetFaultRead[]>([]);
  readonly language = input.required<Language>();
  readonly now = input.required<number>();

  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => faultsText(this.language()));
  protected readonly system = signal<FleetFaultSystem | null>(null);
  protected readonly findings = computed(() => {
    const check = this.check();
    const lamps = this.lamps();
    if (!check) {
      return [];
    }
    return lamps ? withCurrentLamps(check.findings, lamps) : check.findings;
  });
  protected readonly shown = computed(() => {
    const system = this.system();
    return system
      ? this.findings().filter((finding) => finding.system === system)
      : this.findings();
  });
  protected readonly state = computed((): { tone: StatusTone; title: string; detail: string } => {
    const check = this.check();
    const scanner = this.text().scanner;
    if (!check) {
      return { tone: 'neutral', title: scanner.notChecked, detail: scanner.notCheckedHint };
    }
    const findings = this.findings();
    const detail = interpolate(scanner.checked, { time: this.relative(check.checkedAt) });
    const worst = worstSeverity(findings);
    return worst
      ? {
          tone: severityTone(worst),
          title:
            findings.length === 1
              ? scanner.foundOne
              : interpolate(scanner.foundMany, { count: findings.length }),
          detail,
        }
      : { tone: 'success', title: scanner.allClear, detail };
  });
  protected readonly staleText = computed(() => {
    const check = this.check();
    if (!check) {
      return null;
    }
    if (!check.dataAsOf) {
      return this.text().scanner.noData;
    }
    return this.now() - Date.parse(check.dataAsOf) > STALE_AFTER
      ? interpolate(this.text().scanner.stale, { time: this.format.dateTime(check.dataAsOf) })
      : null;
  });
  protected readonly emptyText = computed(() => {
    const system = this.system();
    return system
      ? interpolate(this.text().scanner.systemClear, { system: this.text().systems[system] })
      : this.text().scanner.allClear;
  });
  protected readonly readText = computed(() => {
    const read = latestFaultRead(this.reads());
    const scanner = this.text().scanner;
    return read
      ? `${scanner.readStatus[read.status]} · ${this.format.dateTime(read.completedAt ?? read.createdAt)}`
      : scanner.readNone;
  });

  protected relative(iso: string): string {
    return formatRelative(iso, this.now(), this.language());
  }

  protected title(finding: FleetFaultFinding): string {
    return findingTitle(finding, this.language());
  }

  protected code(finding: FleetFaultFinding): string | null {
    return findingCode(finding);
  }

  protected meaning(finding: FleetFaultFinding): string | null {
    return finding.fmi === null ? null : faultFmi(finding.fmi, this.language());
  }

  protected tone(finding: FleetFaultFinding): StatusTone {
    return severityTone(finding.severity);
  }

  protected severity(finding: FleetFaultFinding) {
    return toneSeverity(severityTone(finding.severity));
  }

  protected timing(finding: FleetFaultFinding): string {
    const scanner = this.text().scanner;
    const last = interpolate(scanner.lastSeen, { time: this.relative(finding.lastSeenAt) });
    return finding.source === 'CAN_REPORT'
      ? `${interpolate(scanner.times, { count: finding.occurrences })} · ${last}`
      : `${interpolate(scanner.since, { time: this.format.dateTime(finding.since) })} · ${last}`;
  }
}
