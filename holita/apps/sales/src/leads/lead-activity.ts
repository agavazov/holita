import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
  type ElementRef,
  type ResourceRef,
} from '@angular/core';
import {
  EmptyState,
  RowActions,
  UI_LANGUAGE,
  confirmAction,
  confirmDialogPt,
  displayTimeZone,
  formatDateTime,
  injectDrawerHost,
  listRecord,
  uiMessages,
  type ListAction,
} from '@osnova/ui';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type {
  SalesLeadNoteFieldsFragment,
  SalesLeadTaskFieldsFragment,
  SalesLeadNotesQuery,
} from '../generated/leads-operations';
import { LeadNotesApi } from './lead-notes-api';
import { leadStrings } from './lead-strings';
import { isOpenTask, leadTaskSeverity } from './lead-task';

type NoteAction = 'edit' | 'remove';
type ActivityEntry =
  | { kind: 'note'; at: string; row: SalesLeadNotesQuery['leadNotes'][number] }
  | { kind: 'task'; at: string; task: SalesLeadTaskFieldsFragment };

@Component({
  selector: 'holita-lead-activity',
  imports: [ButtonDirective, ConfirmDialog, EmptyState, Message, RowActions, Skeleton, Tag],
  providers: [ConfirmationService],
  templateUrl: './lead-activity.html',
  styles: `
    ol {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    li + li {
      border-block-start: 1px solid var(--p-app-panel-border-color);
      padding-block-start: var(--p-app-space-3);
    }

    .note-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadActivity {
  readonly leadId = input.required<string>();
  readonly tasks = input.required<ResourceRef<SalesLeadTaskFieldsFragment[] | undefined>>();
  readonly add = output();
  readonly edit = output<string>();

  private readonly api = inject(LeadNotesApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listHost = injectDrawerHost();
  private readonly lifetime = new AbortController();
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly revision = signal(0);
  private readonly context = computed(() => ({ scope: this.api.scope(), leadId: this.leadId() }));
  private readonly failedContext = signal<ReturnType<LeadActivity['context']> | null>(null);
  protected readonly removing = signal(false);
  protected readonly removalLabel = signal<string | null>(null);
  protected readonly removeFailed = computed(() => this.failedContext() === this.context());
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly taskSeverity = leadTaskSeverity;
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'remove-note-detail'),
  );
  protected readonly list = resource({
    params: () => {
      const { scope, leadId } = this.context();
      return scope ? { scope, leadId, revision: this.revision() } : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.list(params.scope, params.leadId, abortSignal),
  });
  protected readonly entries = computed(() => {
    const tasks = this.tasks();
    const notes = this.list.hasValue() ? this.list.value() : [];
    const entries: ActivityEntry[] = notes.map((row) => ({
      kind: 'note',
      at: row.note.occurredAt,
      row,
    }));
    for (const task of tasks.hasValue() ? tasks.value() : []) {
      if (!isOpenTask(task.status)) {
        entries.push({ kind: 'task', at: task.updatedAt, task });
      }
    }
    return entries.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  });
  protected readonly actions = computed<
    readonly ListAction<NoteAction, SalesLeadNoteFieldsFragment>[]
  >(() => [
    { id: 'edit', label: this.text().editNote, appliesTo: () => !this.removing() },
    {
      id: 'remove',
      label: this.text().removeNote,
      danger: true,
      appliesTo: () => !this.removing(),
    },
  ]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.lifetime.abort();
    });
  }

  refresh(): void {
    this.revision.update((revision) => revision + 1);
  }

  protected retry(): void {
    if (this.list.error()) {
      this.refresh();
    }
    if (this.tasks().error()) {
      this.tasks().reload();
    }
  }

  protected occurrence(iso: string): string {
    return formatDateTime(iso, this.language(), displayTimeZone, true);
  }

  protected record(note: SalesLeadNoteFieldsFragment) {
    return listRecord(this.actions(), note, note.id, this.noteLabel(note));
  }

  private noteLabel(note: SalesLeadNoteFieldsFragment): string {
    const characters = Array.from(note.text.replace(/\s+/gu, ' '));
    const excerpt = characters.slice(0, 64).join('');
    return `${this.occurrence(note.occurredAt)} · ${excerpt}${characters.length > 64 ? '…' : ''}`;
  }

  protected async run(action: NoteAction, note: SalesLeadNoteFieldsFragment): Promise<void> {
    const context = this.context();
    const { scope, leadId } = context;
    if (!scope || this.removing()) {
      return;
    }
    if (action === 'edit') {
      this.edit.emit(note.id);
      return;
    }
    this.failedContext.set(null);
    this.removing.set(true);
    this.removalLabel.set(this.noteLabel(note));
    try {
      const confirmed = await confirmAction(this.confirmation, scope.language, {
        header: this.text().removeNoteQuestion,
        acceptLabel: this.text().removeNote,
        danger: true,
        signal: this.lifetime.signal,
      });
      if (!confirmed || this.context() !== context) {
        return;
      }
      await this.api.remove(scope, leadId, note.id);
      if (!this.destroyRef.destroyed && this.context() === context) {
        this.refresh();
        this.heading().nativeElement.focus();
        this.listHost.saved({ message: this.text().noteRemoved, recordId: null });
      }
    } catch {
      this.failedContext.set(context);
    } finally {
      this.removing.set(false);
      this.removalLabel.set(null);
    }
  }
}
