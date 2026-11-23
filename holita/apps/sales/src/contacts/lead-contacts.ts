import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { operatorStrings } from '@holita/operator';
import {
  RowActions,
  TablePanel,
  UI_LANGUAGE,
  listRecord,
  tableView,
  trackById,
  uiMessages,
  type ListAction,
  type ListActionRequest,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { SalesLeadContactFieldsFragment } from '../generated/contacts-operations';
import { contactLabel, contactRoleLabels, contactStrings } from './contact-labels';
import { ContactsApi } from './contacts-api';

type ContactAction = 'edit' | 'remove';
type Contact = SalesLeadContactFieldsFragment;

@Component({
  selector: 'holita-lead-contacts',
  imports: [ButtonDirective, RowActions, TableModule, TablePanel, Tag],
  templateUrl: './lead-contacts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadContacts {
  readonly leadId = input.required<string>();
  readonly add = output();
  readonly edit = output<string>();

  private readonly api = inject(ContactsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);
  private readonly language = inject(UI_LANGUAGE);
  readonly removing = signal(false);

  protected readonly text = computed(() => contactStrings[this.language()]);
  private readonly roles = computed(() => contactRoleLabels(this.text()));
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly trackById = trackById;
  protected readonly actionContext = computed(() => ({
    scope: this.api.scope(),
    leadId: this.leadId(),
  }));
  protected readonly removeFailure = signal<ReturnType<LeadContacts['actionContext']> | null>(null);
  protected readonly list = resource({
    params: () => {
      const { scope, leadId } = this.actionContext();
      return scope ? { scope, leadId } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.listForLead(params.scope, params.leadId, abortSignal),
  });
  protected readonly rows = linkedSignal<
    { context: ReturnType<LeadContacts['actionContext']>; data: Contact[] | undefined },
    Contact[] | null
  >({
    source: () => ({
      context: this.actionContext(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.context === current.context ? previous.value : null),
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.rows()?.length ?? null,
      filtered: false,
    }),
  );
  protected readonly actions = computed<readonly ListAction<ContactAction, Contact>[]>(() => [
    {
      id: 'edit',
      label: operatorStrings[this.language()].edit,
      appliesTo: () => !this.removing(),
    },
    {
      id: 'remove',
      label: this.text().removeContact,
      appliesTo: () => !this.removing(),
      danger: true,
      confirm: {
        title: this.text().removeContactQuestion,
        detail: this.text().removeContactDetail,
        accept: this.text().removeContact,
      },
    },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().contactName,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'role', label: this.text().contactRole, width: '8rem' },
    { id: 'phone', label: this.text().contactPhone, width: '11rem' },
    { id: 'email', label: this.text().contactEmail, width: '15rem' },
    {
      id: 'primary',
      label: this.text().contactPrimary,
      width: '7rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    {
      id: 'actions',
      label: this.shared().pageHeader.actions,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);

  refresh(): void {
    this.list.reload();
  }

  protected roleLabel(contact: Contact): string {
    return this.roles()[contact.role];
  }

  protected record(contact: Contact) {
    return listRecord(
      this.actions(),
      contact,
      contact.id,
      contactLabel(contact, this.text().unnamedContact),
    );
  }

  protected async run(request: ListActionRequest<ContactAction>): Promise<void> {
    const id = request.ids[0];
    const context = this.actionContext();
    const { scope, leadId } = context;
    if (!id || !scope || this.removing()) {
      return;
    }
    if (request.action === 'edit') {
      this.edit.emit(id);
      return;
    }

    this.removeFailure.set(null);
    this.removing.set(true);
    try {
      await this.api.remove(scope, leadId, id);
      if (!this.destroyRef.destroyed && this.actionContext() === context) {
        this.messages.add({ severity: 'success', summary: this.text().contactRemoved });
        this.refresh();
      }
    } catch {
      if (!this.destroyRef.destroyed && this.actionContext() === context) {
        this.removeFailure.set(context);
      }
    } finally {
      this.removing.set(false);
    }
  }
}
