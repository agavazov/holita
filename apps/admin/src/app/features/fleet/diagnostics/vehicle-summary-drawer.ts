import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { diagnosticsLink, type DiagnosticSection } from './diagnostic-navigation';
import type { DiagnosticScenario } from './fault-mapping';
import { VehicleSummary } from './vehicle-summary';
import bg from './vehicle-context.bg.json';
import en from './vehicle-context.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-vehicle-summary-drawer',
  imports: [RouterLink, ButtonDirective, RouteDrawer, EmptyState, VehicleSummary],
  templateUrl: './vehicle-summary-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleSummaryDrawer {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly section = input.required<DiagnosticSection>();
  readonly source = input.required<FleetEvidenceSource>();
  readonly scenario = input<DiagnosticScenario | null>(null);
  readonly conditions = input<readonly FilterCondition[]>([]);
  readonly loading = input(false);
  readonly errorText = input<string | null>(null);
  readonly retry = output();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly vehicleId = computed(() => this.params().get('vehicleSummary') ?? '');
  protected readonly vehicle = computed(
    () =>
      this.scenario()?.vehicles.find(
        (row) =>
          row.id === this.vehicleId() &&
          row.provenance.source === 'HOLITA_SCENARIO' &&
          row.provenance.scenarioId === this.scenario()?.id,
      ) ?? null,
  );
  protected readonly subtitle = computed(() =>
    this.source() === 'HOLITA_SCENARIO'
      ? (this.vehicle()?.label ?? this.text().unknownVehicle)
      : this.text().realSource,
  );
  protected readonly periodConditions = computed(() =>
    this.conditions().filter((row) => row.field === 'observedOn' || row.field === 'trip'),
  );
  protected readonly state = computed<RouteDrawerState>(() =>
    this.source() !== 'HOLITA_SCENARIO'
      ? 'ready'
      : this.loading() && !this.scenario()
        ? 'loading'
        : this.errorText()
          ? 'error'
          : this.vehicle()
            ? 'ready'
            : 'not-found',
  );
  protected readonly backLabel = computed(() => {
    const selected =
      this.section() === 'faults' ? 'fault' : this.section() === 'logs' ? 'log' : 'evaluation';
    return this.source() === 'HOLITA_SCENARIO' && this.params().has(selected)
      ? this.text().backToRecord
      : this.text().backToList;
  });
  protected readonly logLink = (id: string) => this.link('logs', id);
  protected readonly faultLink = (id: string) => this.link('faults', id);
  protected readonly riskLink = (id: string) => this.link('risk', id);

  protected closeLink() {
    return this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { vehicleSummary: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }
  protected close(): void {
    void this.router.navigateByUrl(this.closeLink());
  }
  private link(target: DiagnosticSection, id: string) {
    return diagnosticsLink(
      this.router,
      this.branchId(),
      this.language(),
      this.section(),
      target,
      this.params(),
      id,
    );
  }
}
