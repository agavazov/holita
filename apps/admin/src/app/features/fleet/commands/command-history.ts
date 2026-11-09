import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { Language } from '../../../i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../../ui/list/list-actions';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import {
  commandOutcome,
  commandPurpose,
  commandSeverity,
  commandState,
  commandText,
  type CommandRequest,
} from './command-presentation';

@Component({
  selector: 'discocan-command-history',
  imports: [ButtonDirective, TableModule, Tag, TablePanel, RowActions],
  templateUrl: './command-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class CommandHistory {
  readonly requests = input.required<readonly CommandRequest[]>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly inspect = output<CommandRequest>();
  readonly retry = output();
  protected readonly text = computed(() => commandText[this.language()]);
  protected readonly format = injectFleetFormat();
  protected readonly trackById = trackById;
  protected readonly tableMinWidth = '69rem';
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'purpose',
      label: this.text().purpose,
      width: '18rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'target', label: this.text().target, width: '12rem' },
    { id: 'requested', label: this.text().requested, width: '11rem', kind: 'date' },
    { id: 'status', label: this.text().status, width: '12rem', kind: 'status' },
    { id: 'outcome', label: this.text().outcome, width: '12rem', className: 'app-col-secondary' },
    {
      id: 'actions',
      label: this.text().actions,
      width: '4rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly actions = computed<readonly ListAction<'details', CommandRequest>[]>(() => [
    { id: 'details', label: this.text().details },
  ]);
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.requests().length,
      filtered: false,
    }),
  );
  protected readonly rows = computed(() =>
    this.requests().map((request) => ({
      id: request.id,
      request,
      purpose: commandPurpose(request, this.language()),
      requested: this.format.dateTimeCell(request.requestedAt),
      status: this.text().states[commandState(request)],
      severity: commandSeverity(request),
      outcome: commandOutcome(request, this.language()),
      record: listRecord(
        this.actions(),
        request,
        request.id,
        commandPurpose(request, this.language()),
      ),
    })),
  );

  protected run(event: ListActionRequest<'details'>): void {
    const request = this.requests().find((row) => row.id === event.ids[0]);
    if (request) {
      this.inspect.emit(request);
    }
  }
}
