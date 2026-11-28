import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  EmptyState,
  FormField,
  PageHeader,
  UI_LANGUAGE,
  injectDisplayFormat,
  injectDrawerHost,
  injectPageRecord,
  lockWhileSaving,
  uiMessages,
  type DrawerHost,
  type PageHeaderAction,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { contactStrings } from '../contacts/contact-labels';
import { LeadContacts } from '../contacts/lead-contacts';
import type { LeadStage } from '../generated/leads-operations';
import { LeadActivity } from './lead-activity';
import { agentLabel, injectLeadAgents } from './lead-agent';
import { injectLeadRecord, leadLabel } from './lead-record';
import { leadStageOptions, leadStageSeverity } from './lead-stage';
import { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

@Component({
  selector: 'holita-lead-detail-page',
  imports: [
    PageHeader,
    EmptyState,
    ButtonDirective,
    FormField,
    ReactiveFormsModule,
    Select,
    Skeleton,
    RouterOutlet,
    LeadContacts,
    LeadActivity,
    Tag,
  ],
  templateUrl: './lead-detail-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailPage {
  private readonly api = inject(LeadsApi);
  private readonly listHost = injectDrawerHost();
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(UI_LANGUAGE);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  private readonly id = computed(() => this.params().get('recordId'));
  readonly entry = injectLeadRecord(this.id);
  private readonly contacts = viewChild(LeadContacts);
  private readonly activity = viewChild(LeadActivity);
  private readonly stageSelect = viewChild<Select>('stagePicker');
  private readonly assignmentSelect = viewChild<Select>('assignmentPicker');
  protected readonly name = computed(() => {
    const lead = this.entry.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly backLink = computed(() => ['/', this.language(), 'leads']);
  protected readonly backLabel = computed(() => operatorStrings[this.language()].leads);
  protected readonly format = injectDisplayFormat();
  protected readonly stageSeverity = leadStageSeverity;
  protected readonly stageOptions = computed(() => leadStageOptions(this.language()));
  private readonly stage = computed(() => this.entry.lead()?.stage ?? null);
  protected readonly stageForm = new FormGroup({ stage: new FormControl<LeadStage | null>(null) });
  protected readonly selectedStage = toSignal(this.stageForm.controls.stage.valueChanges, {
    initialValue: null,
  });
  protected readonly savingStage = signal(false);
  protected readonly stageError = signal<string | null>(null);
  protected readonly team = injectLeadAgents();
  private readonly creatorId = computed(() => this.entry.lead()?.createdByUserId);
  protected readonly assigneeId = computed(() => this.entry.lead()?.assignedAgentUserId ?? '');
  protected readonly namedAgents = injectLeadAgents(() => [this.creatorId(), this.assigneeId()]);
  protected readonly creatorName = computed(() => this.nameFor(this.creatorId()));
  protected readonly assignmentOptions = computed(() => {
    const team = this.team.hasValue() ? this.team.value() : [];
    const options = [
      { value: '', label: this.text().assignments.unassigned, disabled: false },
      ...team.map((agent) => ({ value: agent.id, label: agent.name, disabled: false })),
    ];
    const id = this.assigneeId();
    if (id && !team.some((agent) => agent.id === id)) {
      options.push({ value: id, label: this.nameFor(id), disabled: true });
    }
    return options;
  });
  protected readonly assignmentForm = new FormGroup({
    agent: new FormControl('', { nonNullable: true }),
  });
  protected readonly selectedAgent = toSignal(this.assignmentForm.controls.agent.valueChanges, {
    initialValue: '',
  });
  protected readonly savingAssignment = signal(false);
  protected readonly assignmentError = signal<string | null>(null);
  protected readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.entry.lead()
      ? [
          { id: 'edit', label: this.text().editLead, primary: true },
          {
            id: 'add-contact',
            label: contactStrings[this.language()].newContact,
            disabled: this.contacts()?.removing() ?? false,
          },
        ]
      : [],
  );
  protected readonly drawerHost: DrawerHost = {
    saved: (event) => {
      if (this.route.firstChild?.snapshot.data['contactEditor'] === true) {
        this.contacts()?.refresh();
        this.listHost.saved({ message: event.message, recordId: null });
      } else if (this.route.firstChild?.snapshot.data['noteEditor'] === true) {
        this.activity()?.refresh();
        this.listHost.saved(event);
      } else {
        this.entry.record.reload();
        this.listHost.saved(event);
      }
    },
  };

  constructor() {
    effect(() => {
      this.stageForm.reset({ stage: this.stage() });
      this.stageError.set(null);
    });
    effect(() => {
      this.assignmentForm.reset({ agent: this.assigneeId() });
      this.assignmentError.set(null);
    });
    lockWhileSaving(this.stageForm, this.savingStage, () => {
      if (this.stageError()) {
        this.stageSelect()?.focus();
      }
    });
    lockWhileSaving(this.assignmentForm, this.savingAssignment, () => {
      if (this.assignmentError()) {
        this.assignmentSelect()?.focus();
      }
    });
    injectPageRecord(this.name, () => {
      const fragment = this.fragment();
      return this.router.createUrlTree(this.backLink(), {
        queryParams: this.queryParams(),
        ...(fragment === null ? {} : { fragment }),
      });
    });
  }

  protected async saveStage(): Promise<void> {
    const lead = this.entry.lead();
    const routeId = this.id();
    const scope = this.api.scope();
    const stage = this.selectedStage();
    if (
      !lead ||
      !scope ||
      !stage ||
      stage === lead.stage ||
      this.savingStage() ||
      this.savingAssignment()
    ) {
      return;
    }
    const isCurrent = () =>
      !this.destroyRef.destroyed && this.api.scope() === scope && this.id() === routeId;
    this.savingStage.set(true);
    this.stageError.set(null);
    try {
      const updated = await this.api.updateStage(scope, lead.id, stage);
      if (isCurrent()) {
        this.entry.record.set(updated);
      }
      if (this.api.scope() === scope) {
        this.listHost.saved({ message: this.text().stageSaved, recordId: null });
      }
    } catch {
      if (isCurrent()) {
        this.stageError.set(this.text().stageSaveFailed);
      }
    } finally {
      this.savingStage.set(false);
    }
  }

  protected async saveAssignment(): Promise<void> {
    const lead = this.entry.lead();
    const routeId = this.id();
    const scope = this.api.scope();
    const assignee = this.selectedAgent();
    if (
      !lead ||
      !scope ||
      assignee === this.assigneeId() ||
      this.savingAssignment() ||
      this.savingStage()
    ) {
      return;
    }
    const isCurrent = () =>
      !this.destroyRef.destroyed && this.api.scope() === scope && this.id() === routeId;
    this.savingAssignment.set(true);
    this.assignmentError.set(null);
    try {
      const updated = await this.api.updateAssignment(scope, lead.id, assignee || null);
      if (isCurrent()) {
        this.entry.record.set({ ...lead, ...updated });
      }
      if (this.api.scope() === scope) {
        this.listHost.saved({ message: this.text().assignmentSaved, recordId: null });
      }
    } catch {
      if (isCurrent()) {
        this.assignmentError.set(this.text().assignmentSaveFailed);
        this.team.reload();
      }
    } finally {
      this.savingAssignment.set(false);
    }
  }

  private nameFor(id: string | undefined): string {
    if (this.namedAgents.isLoading()) {
      return '—';
    }
    const agent = this.namedAgents.hasValue()
      ? this.namedAgents.value().find((agent) => agent.id === id)
      : undefined;
    return agentLabel(agent, this.text());
  }

  protected openAction(action: string): void {
    this.open(action === 'edit' ? ['edit'] : ['contacts', 'new']);
  }

  protected editContact(id: string): void {
    this.open(['contacts', id, 'edit']);
  }

  protected addNote(): void {
    this.open(['notes', 'new']);
  }

  protected editNote(id: string): void {
    this.open(['notes', id, 'edit']);
  }

  private open(path: string[]): void {
    void this.router.navigate(path, {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
