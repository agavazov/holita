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
  private readonly stageSelect = viewChild(Select);
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
  protected readonly stageForm = new FormGroup({ stage: new FormControl<LeadStage | null>(null) });
  protected readonly selectedStage = toSignal(this.stageForm.controls.stage.valueChanges, {
    initialValue: null,
  });
  protected readonly savingStage = signal(false);
  protected readonly stageError = signal<string | null>(null);
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
      } else {
        this.entry.record.reload();
        this.listHost.saved(event);
      }
    },
  };

  constructor() {
    effect(() => {
      this.stageForm.reset({ stage: this.entry.lead()?.stage ?? null });
      this.stageError.set(null);
    });
    lockWhileSaving(this.stageForm, this.savingStage, () => {
      if (this.stageError()) {
        this.stageSelect()?.focus();
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
    if (!lead || !scope || !stage || stage === lead.stage || this.savingStage()) {
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

  protected openAction(action: string): void {
    this.open(action === 'edit' ? ['edit'] : ['contacts', 'new']);
  }

  protected editContact(id: string): void {
    this.open(['contacts', id, 'edit']);
  }

  private open(path: string[]): void {
    void this.router.navigate(path, {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
