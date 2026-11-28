import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
  type ResourceRef,
} from '@angular/core';
import {
  EmptyState,
  RowActions,
  UI_LANGUAGE,
  injectDisplayFormat,
  listRecord,
  uiMessages,
  type ListAction,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { LeadTaskStatus, SalesLeadTaskFieldsFragment } from '../generated/leads-operations';
import { leadStrings } from './lead-strings';
import { isOpenTask, leadTaskSeverity } from './lead-task';
import { LeadTasksApi } from './lead-tasks-api';

type Action = 'edit' | LeadTaskStatus;

@Component({
  selector: 'holita-lead-tasks',
  imports: [ButtonDirective, EmptyState, Message, RowActions, Skeleton, Tag],
  templateUrl: './lead-tasks.html',
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

    .task-note {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadTasks {
  readonly leadId = input.required<string>();
  readonly list = input.required<ResourceRef<SalesLeadTaskFieldsFragment[] | undefined>>();
  readonly add = output();
  readonly edit = output<string>();
  readonly saved = output<string>();
  private readonly api = inject(LeadTasksApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly language = inject(UI_LANGUAGE);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly format = injectDisplayFormat();
  protected readonly severity = leadTaskSeverity;
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly openTasks = computed(() => {
    const list = this.list();
    return list.hasValue() ? list.value().filter((task) => isOpenTask(task.status)) : [];
  });
  protected readonly actions = computed<readonly ListAction<Action, SalesLeadTaskFieldsFragment>[]>(
    () => [
      { id: 'edit', label: this.text().editTask },
      {
        id: 'IN_PROGRESS',
        label: this.text().startTask,
        appliesTo: (task) => task.status === 'PENDING',
      },
      {
        id: 'PENDING',
        label: this.text().resetTask,
        appliesTo: (task) => task.status === 'IN_PROGRESS',
      },
      { id: 'COMPLETED', label: this.text().completeTask },
      { id: 'CANCELLED', label: this.text().cancelTask, danger: true },
    ],
  );

  protected record(task: SalesLeadTaskFieldsFragment) {
    const label = `${this.text().taskTypes[task.type]} · ${this.format.dateTime(task.scheduledAt)}`;
    return listRecord(this.actions(), task, task.id, label);
  }

  protected async run(action: Action, task: SalesLeadTaskFieldsFragment): Promise<void> {
    const scope = this.api.scope();
    const leadId = this.leadId();
    if (!scope || this.saving()) {
      return;
    }
    if (action === 'edit') {
      this.edit.emit(task.id);
      return;
    }
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.api.updateStatus(scope, leadId, task.id, action);
      if (!this.destroyRef.destroyed && this.api.scope() === scope && this.leadId() === leadId) {
        if (!isOpenTask(action)) {
          this.heading().nativeElement.focus();
        }
        this.saved.emit(this.text().taskStatusSaved);
      }
    } catch {
      if (!this.destroyRef.destroyed && this.api.scope() === scope && this.leadId() === leadId) {
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
