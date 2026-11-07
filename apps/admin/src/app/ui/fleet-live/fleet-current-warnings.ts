import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { Language } from '../../i18n/messages';
import { injectFleetFormat } from '../format/fleet-format';
import { TablePanel, type TableColumn } from '../table-panel/table-panel';
import { toneSeverity } from '../tones';
import {
  faultsText,
  warningLampLabel,
  warningStateLabel,
  warningTone,
  type FleetWarning,
} from './fault-wording';

@Component({
  selector: 'holita-fleet-current-warnings',
  imports: [TablePanel, TableModule, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <holita-table-panel
      mode="local"
      [heading]="text().currentWarnings"
      [view]="{ kind: rows().length ? 'rows' : 'empty' }"
      [total]="rows().length"
      [columns]="columns()"
      tableMinWidth="36rem"
      [emptyTitle]="text().noCurrentWarnings"
    >
      <p-table
        [value]="rows()"
        [scrollable]="true"
        [pt]="{ tableContainer: { tabindex: '0', 'aria-label': text().currentWarnings } }"
        [tableStyle]="{ 'min-width': 'var(--app-table-responsive-min-width)' }"
      >
        <ng-template #colgroup
          ><colgroup>
            @for (column of columns(); track column.id) {
              <col [style.width]="column.width" />
            }</colgroup
        ></ng-template>
        <ng-template #header
          ><tr>
            @for (column of columns(); track column.id) {
              <th scope="col">{{ column.label }}</th>
            }
          </tr></ng-template
        >
        <ng-template #body let-row
          ><tr>
            <td>
              <span class="app-cell-identity">{{ row.lamp }}</span>
            </td>
            <td>
              <span class="app-cell-status"
                ><p-tag [value]="row.state" [severity]="row.severity"
              /></span>
            </td>
            <td>
              <time
                class="app-cell-date"
                [attr.datetime]="row.since"
                [title]="fmt.utc(row.since)"
                >{{ fmt.dateTime(row.since) }}</time
              >
            </td>
          </tr></ng-template
        >
      </p-table>
    </holita-table-panel>
  `,
})
export class FleetCurrentWarnings {
  readonly warnings = input.required<readonly FleetWarning[]>();
  readonly language = input.required<Language>();
  protected readonly fmt = injectFleetFormat();
  protected readonly text = computed(() => faultsText(this.language()));
  protected readonly rows = computed(() =>
    this.warnings().map((warning) => ({
      lamp: warningLampLabel(warning.parameterId, this.language()),
      state: warningStateLabel(warning.state, this.language()),
      severity: toneSeverity(warningTone(warning.state)),
      since: warning.stateSince,
    })),
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    { id: 'lamp', label: this.text().lamp, width: '40%', kind: 'identity' },
    { id: 'state', label: this.text().state, width: '25%', kind: 'status' },
    { id: 'since', label: this.text().since, width: '35%', kind: 'date' },
  ]);
}
