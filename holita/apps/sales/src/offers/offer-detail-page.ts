import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  resource,
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
  type PageHeaderAction,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import {
  contactFields,
  offerIdPattern,
  offerLabel,
  offerPrice,
  offerStrings,
  quoteKinds,
  siteFields,
} from './offer';
import { OffersApi } from './offers-api';

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
  styles: '.offer-text { white-space: pre-wrap; overflow-wrap: anywhere; }',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDetailPage {
  private readonly api = inject(OffersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listHost = injectDrawerHost();
  private readonly header = viewChild.required(PageHeader);
  protected readonly language = inject(UI_LANGUAGE);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  readonly id = computed(() => this.params().get('recordId'));
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
  protected readonly backLink = computed(() => ['/', this.language(), 'offers']);
  protected readonly backLabel = computed(() => operatorStrings[this.language()].offers);
  protected readonly quoteKinds = quoteKinds;
  protected readonly price = offerPrice;
  protected readonly contactFields = contactFields;
  protected readonly siteFields = siteFields;
  protected readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.offer() ? [{ id: 'edit', label: this.text().editOffer, primary: true }] : [],
  );
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
      return this.router.createUrlTree(this.backLink(), {
        queryParams: this.queryParams(),
        ...(fragment === null ? {} : { fragment }),
      });
    });
  }

  protected openEdit(): void {
    void this.router.navigate(['edit'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
