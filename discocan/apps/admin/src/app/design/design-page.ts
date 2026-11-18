import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type TemplateRef,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { loadDesignPage } from '@osnova/ui/design';
import { UI_LANGUAGE } from '@osnova/ui';
import { FleetConnection } from '../ui/fleet-live/fleet-connection';
import { FleetLastReport } from '../ui/fleet-live/fleet-last-report';
import { FleetNow } from '../ui/fleet-live/fleet-now';
import { FleetCurrentWarnings } from '../ui/fleet-live/fleet-current-warnings';
import { FleetFaultCoverage } from '../ui/fleet-live/fleet-fault-coverage';
import { FleetLiveSummary } from '../ui/fleet-live/fleet-live-summary';
import { FaultScanner } from '../ui/fleet-live/fault-scanner';
import { FleetFaults } from '../ui/fleet-live/fleet-faults';

@Component({
  selector: 'discocan-design-wrapper',
  imports: [
    FleetConnection,
    FleetLastReport,
    FleetNow,
    FleetCurrentWarnings,
    FleetFaultCoverage,
    FleetLiveSummary,
    FaultScanner,
    FleetFaults,
  ],
  templateUrl: './design-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: UI_LANGUAGE,
      useFactory: () =>
        signal(
          inject(ActivatedRoute).snapshot.paramMap.get('language') === 'en'
            ? ('en' as const)
            : ('bg' as const),
        ).asReadonly(),
    },
  ],
})
export class DesignPage {
  readonly language = inject(UI_LANGUAGE);
  private readonly designHost = viewChild.required('designHost', { read: ViewContainerRef });
  private readonly fleetSection = viewChild.required<TemplateRef<unknown>>('fleetSection');

  constructor() {
    afterNextRender(() => {
      void this.mountDesign();
    });
  }

  private async mountDesign(): Promise<void> {
    const sharedDesign = await loadDesignPage();
    const view = this.fleetSection().createEmbeddedView(null);
    view.detectChanges();
    const rootNodes: unknown[] = view.rootNodes;
    const nodes = rootNodes.filter((node): node is Node => node instanceof Node);
    const component = this.designHost().createComponent(sharedDesign, {
      projectableNodes: [nodes],
    });
    component.setInput('activityLabel', 'Fleet activity');
    component.setInput('summaryLabel', 'Fleet summary');
    component.onDestroy(() => {
      view.destroy();
    });
  }
}
