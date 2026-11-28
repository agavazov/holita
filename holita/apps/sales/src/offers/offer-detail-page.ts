import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  EmptyState,
  FormatDateOnlyPipe,
  FormatDateTimePipe,
  FormatNumberPipe,
  PageHeader,
  UI_LANGUAGE,
  injectDrawerHost,
  injectPageRecord,
  uiMessages,
  type DrawerHost,
  type MenuChoice,
  type PageHeaderAction,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { SalesOfferAction, SalesOfferStatus } from '../generated/offers-operations';
import {
  contactFields,
  offerIdPattern,
  offerLabel,
  offerPrice,
  offerStatusLabel,
  offerStatusSeverity,
  offerStrings,
  quoteKinds,
  siteFields,
} from './offer';
import { OffersApi } from './offers-api';

const nextActions = {
  DRAFT: { action: 'PREPARE', label: 'markPrepared' },
  PREPARED: { action: 'MARK_MANUALLY_SENT', label: 'markManuallySent' },
  MANUALLY_SENT: { action: 'CLEAR_MANUALLY_SENT', label: 'clearManuallySent' },
} as const satisfies Record<
  SalesOfferStatus,
  { action: SalesOfferAction; label: keyof typeof offerStrings.en }
>;

@Component({
  selector: 'holita-offer-detail-page',
  imports: [
    ButtonDirective,
    EmptyState,
    FormatDateOnlyPipe,
    FormatDateTimePipe,
    FormatNumberPipe,
    PageHeader,
    RouterLink,
    RouterOutlet,
    Skeleton,
    Tag,
  ],
  templateUrl: './offer-detail-page.html',
  styles: `
    .offer-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .offer-document .app-card-grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    }

    .offer-document > header h2,
    .offer-document .app-facts dd {
      overflow-wrap: anywhere;
    }
  `,
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDetailPage {
  private readonly api = inject(OffersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);
  private readonly listHost = injectDrawerHost();
  private readonly header = viewChild.required(PageHeader);
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly preview = this.route.snapshot.data['printPreview'] === true;
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  readonly id = computed(() => this.params().get('recordId')?.toLowerCase() ?? null);
  readonly validId = computed(() => offerIdPattern.test(this.id() ?? ''));
  readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && this.validId() ? { scope, id } : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.find(params.scope, params.id, abortSignal),
  });
  readonly offer = computed(() => (this.record.hasValue() ? this.record.value() : null));
  protected readonly text = computed(() => offerStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly name = computed(() => {
    const offer = this.offer();
    return offer ? offerLabel(offer, this.text().untitledOffer) : null;
  });
  private readonly offersLink = computed(() => ['/', this.language(), 'offers']);
  protected readonly backLink = computed(() =>
    this.preview ? [...this.offersLink(), this.id() ?? ''] : this.offersLink(),
  );
  protected readonly backLabel = computed(() =>
    this.preview ? this.text().backToOffer : operatorStrings[this.language()].offers,
  );
  protected readonly quoteKinds = quoteKinds;
  protected readonly price = offerPrice;
  protected readonly statusLabel = offerStatusLabel;
  protected readonly statusSeverity = offerStatusSeverity;
  protected readonly contactFields = contactFields;
  protected readonly siteFields = siteFields;
  protected readonly hasContact = computed(() =>
    contactFields.some(({ key }) => this.offer()?.[key] != null),
  );
  protected readonly hasSite = computed(() =>
    siteFields.some(({ key }) => key !== 'validUntil' && this.offer()?.[key] != null),
  );
  protected readonly changingStatus = signal(false);
  protected readonly nextActions = nextActions;
  protected readonly actions = computed<readonly PageHeaderAction[]>(() => {
    const item = this.offer();
    if (!item) {
      return [];
    }
    if (this.preview) {
      return [{ id: 'print', label: this.text().printOffer, primary: true }];
    }
    const preview = { id: 'preview', label: this.text().previewOffer, primary: true };
    return item.status === 'MANUALLY_SENT'
      ? [preview]
      : [preview, { id: 'edit', label: this.text().editOffer, disabled: this.changingStatus() }];
  });
  protected readonly drawerHost: DrawerHost = {
    saved: (event) => {
      this.record.reload();
      this.listHost.saved(event);
    },
  };

  constructor() {
    afterNextRender(() => {
      if (!this.route.firstChild) {
        this.header().focusTitle();
      }
    });
    injectPageRecord(this.name, () => {
      const fragment = this.fragment();
      return this.router.createUrlTree(this.offersLink(), {
        queryParams: this.queryParams(),
        ...(fragment === null ? {} : { fragment }),
      });
    });
  }

  protected runAction({ id }: MenuChoice): void {
    if (id === 'print') {
      this.document.defaultView?.print();
      return;
    }
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  protected async changeStatus(action: SalesOfferAction): Promise<void> {
    const scope = this.api.scope();
    const item = this.offer();
    if (!scope || !item || this.changingStatus()) {
      return;
    }
    this.changingStatus.set(true);
    try {
      const updated = await this.api.transition(scope, item.id, action);
      if (this.api.scope() !== scope) {
        return;
      }
      if (!this.destroyRef.destroyed && this.id() === item.id) {
        this.record.set(updated);
      }
      this.listHost.saved({ message: this.text().statusChanged, recordId: null });
    } catch {
      this.messages.add({ severity: 'error', summary: this.text().statusChangeFailed });
    } finally {
      this.changingStatus.set(false);
    }
  }
}
