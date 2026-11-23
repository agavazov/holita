import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  EmptyState,
  PageHeader,
  UI_LANGUAGE,
  injectDisplayFormat,
  injectPageRecord,
  uiMessages,
  type DrawerHost,
  type PageHeaderAction,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { contactStrings } from '../contacts/contact-labels';
import { LeadContacts } from '../contacts/lead-contacts';
import { injectLeadRecord, leadLabel } from './lead-record';
import { leadStrings } from './lead-strings';

@Component({
  selector: 'holita-lead-detail-page',
  imports: [PageHeader, EmptyState, ButtonDirective, Skeleton, RouterOutlet, LeadContacts],
  templateUrl: './lead-detail-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly language = inject(UI_LANGUAGE);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  private readonly id = computed(() => this.params().get('recordId'));
  readonly entry = injectLeadRecord(this.id);
  private readonly contacts = viewChild(LeadContacts);
  protected readonly name = computed(() => {
    const lead = this.entry.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly backLink = computed(() => ['/', this.language(), 'leads']);
  protected readonly backLabel = computed(() => operatorStrings[this.language()].leads);
  protected readonly format = injectDisplayFormat();
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
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      if (this.route.firstChild?.snapshot.data['contactEditor'] === true) {
        this.contacts()?.refresh();
      } else {
        this.entry.record.reload();
      }
    },
  };

  constructor() {
    injectPageRecord(this.name, () => {
      const fragment = this.fragment();
      return this.router.createUrlTree(this.backLink(), {
        queryParams: this.queryParams(),
        ...(fragment === null ? {} : { fragment }),
      });
    });
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
