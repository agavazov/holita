import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import type {
  AdminEventDetailsFragment,
  AdminStoresQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { EventsApi, type EventAction, type EventActionTarget } from './events-api';
import { EventActionDialog } from './event-action-dialog/event-action-dialog';
import { SessionProgram } from '../sessions/session-program/session-program';
import { EventSpeakers } from '../sessions/event-speakers/event-speakers';
import { SessionsApi } from '../sessions/sessions-api';
import { MediaApi } from '../media/media-api';
import { EventGallery } from '../media/event-gallery/event-gallery';
import { EventHistory } from './event-history/event-history';
import { eventTime, formatEventTime, formatEventCalendarDate } from './event-time';
import { safeDescriptionHtml } from './description-html';
@Component({
  selector: 'holita-event-overview',
  providers: [EventsApi, SessionsApi, MediaApi],
  imports: [
    RouterLink,
    ButtonDirective,
    Message,
    EventActionDialog,
    EventHistory,
    SessionProgram,
    EventSpeakers,
    EventGallery,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
  ],
  templateUrl: './event-overview.html',
  styleUrl: './event-overview.scss',
})
export class EventOverview implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly eventId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  private readonly program = viewChild(SessionProgram);
  private readonly tabs = viewChild(Tabs);
  readonly orderDirty = computed(() => this.program()?.dirty() ?? false);
  private readonly sessionsApi = inject(SessionsApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly api = inject(EventsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly tab = computed(() => {
    const requested = this.params().get('tab');
    return requested === 'history'
      ? 'history'
      : requested === 'sessions' && !this.event()?.deletedAt
        ? 'sessions'
        : 'overview';
  });
  readonly actionTarget = signal<EventActionTarget | null>(null);
  readonly revision = signal(0);
  readonly actionComplete = signal(false);
  readonly sessionSaved = this.router.currentNavigation()?.extras.state?.['sessionSaved'] === true;
  private query: ReturnType<EventsApi['watchEvent']> | undefined;
  readonly event = signal<AdminEventDetailsFragment | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly invalidId = computed(
    () => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.eventId()),
  );
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'events',
  ]);
  readonly safeDescription = computed(() =>
    safeDescriptionHtml(this.event()?.descriptionHtml ?? ''),
  );
  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    if (this.invalidId()) {
      this.loading.set(false);
      return;
    }
    this.sessionsApi.initialize(this.store().id, this.language(), this.eventId());
    this.mediaApi.initialize(this.store().id, this.language(), this.eventId());
    this.sessionsApi.savedChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshAfterSessionWrite();
    });
    this.query = this.api.watchEvent(this.eventId(), true);
    this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error)
          this.event.set(result.data.referenceEvent);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error);
      },
    });
  }
  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.error.set(error);
    });
  }
  changeTab(value: unknown): void {
    if (
      value !== 'overview' &&
      value !== 'history' &&
      (value !== 'sessions' || this.event()?.deletedAt)
    )
      return;
    if (value === this.tab()) return;
    // Keep the mounted program visible until the route's dirty guard accepts the tab.
    this.tabs()?.value.set(this.tab());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: value === 'overview' ? null : value },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }
  requestAction(action: EventAction): void {
    const event = this.event();
    if (!event || this.loading() || this.actionTarget() || this.orderDirty()) return;
    if (Boolean(event.deletedAt) !== (action === 'restore')) return;
    this.actionComplete.set(false);
    this.actionTarget.set({ action, ids: [event.id] });
  }
  actionFinished(): void {
    this.actionTarget.set(null);
    this.actionComplete.set(true);
    this.heading().nativeElement.focus();
    this.revision.update((value) => value + 1);
    this.retry();
  }
  private refreshAfterSessionWrite(): void {
    this.revision.update((value) => value + 1);
    this.retry();
  }
  canLeave(): boolean | Promise<boolean> {
    return this.program()?.canLeave() ?? true;
  }
  date(value: string): string {
    return `${formatEventTime(value, this.language())} ${eventTime(value).format('Z')}`;
  }
  calendarDate(value: string | null): string {
    return value === null ? '—' : formatEventCalendarDate(value, this.language());
  }
  status(value: string): string {
    return value === 'PUBLISHED'
      ? this.text().eventPublished
      : value === 'ARCHIVED'
        ? this.text().eventArchived
        : this.text().eventDraft;
  }
  format(value: string): string {
    return value === 'ONLINE'
      ? this.text().eventOnline
      : value === 'HYBRID'
        ? this.text().eventHybrid
        : this.text().eventInPerson;
  }
}
