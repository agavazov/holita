import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Language } from '../../i18n/messages';
import { BranchContext } from '../branches/branch-context';
import { OverviewPage } from '../fleet/overview/overview-page';

/** Retained adapter for the legacy Control center workspace. */
@Component({
  selector: 'holita-control-center-dashboard',
  imports: [OverviewPage],
  templateUrl: './dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  private readonly branches = inject(BranchContext);
  protected readonly branch = computed(() =>
    this.branches.branches()?.find((branch) => branch.id === this.branchId()),
  );
}
