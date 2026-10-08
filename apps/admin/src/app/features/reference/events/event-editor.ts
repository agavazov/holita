import {
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Message } from 'primeng/message';
import type {
  AdminStoresQuery,
  AdminEventDetailsFragment,
  CreateReferenceEventInput,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { EventsApi } from './events-api';
import { filter, map } from 'rxjs';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { RelationPicker, type RelationLoader } from '../relation-picker';
import { DescriptionEditor } from './description-editor';
import { MediaApi } from '../media/media-api';
import { EventGallery } from '../media/event-gallery/event-gallery';
import {
  eventDraft,
  eventInput,
  eventUpdateInput,
  eventFields,
  eventFieldErrors,
  validateEventDraft,
  eventStatuses,
  eventFormats,
  type EventField,
  type EventDraft,
} from './event-form';

@Component({
  selector: 'holita-event-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    ToggleSwitch,
    Message,
    Select,
    Textarea,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    RelationPicker,
    DescriptionEditor,
    EventGallery,
  ],
  providers: [EventsApi, MediaApi, ConfirmationService],
  templateUrl: './event-editor.html',
  styleUrls: ['../reference-editor.scss', './event-editor.scss'],
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class EventEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly eventId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(EventsApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly gallery = viewChild(EventGallery);
  readonly galleryBusy = computed(() => this.gallery()?.busy() ?? false);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private query: ReturnType<EventsApi['watchEvent']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  private original: AdminEventDetailsFragment | undefined;
  readonly form = new FormGroup({
    title: new FormControl(eventDraft().title, { nonNullable: true }),
    code: new FormControl(eventDraft().code, { nonNullable: true }),
    status: new FormControl(eventDraft().status, { nonNullable: true }),
    format: new FormControl(eventDraft().format, { nonNullable: true }),
    capacity: new FormControl(eventDraft().capacity, { nonNullable: true }),
    budget: new FormControl(eventDraft().budget, { nonNullable: true }),
    featured: new FormControl(eventDraft().featured, { nonNullable: true }),
    startsAt: new FormControl(eventDraft().startsAt, { nonNullable: true }),
    endsAt: new FormControl(eventDraft().endsAt, { nonNullable: true }),
    registrationOpensOn: new FormControl(eventDraft().registrationOpensOn, { nonNullable: true }),
    registrationClosesOn: new FormControl(eventDraft().registrationClosesOn, { nonNullable: true }),
    venueId: new FormControl(eventDraft().venueId, { nonNullable: true }),
    meetingUrl: new FormControl(eventDraft().meetingUrl, { nonNullable: true }),
    tagIds: new FormControl(eventDraft().tagIds, { nonNullable: true }),
    summary: new FormControl(eventDraft().summary, { nonNullable: true }),
    descriptionHtml: new FormControl(eventDraft().descriptionHtml, { nonNullable: true }),
  });
  private readonly formEvents = toSignal(this.form.events);
  private readonly clientErrors = computed(() => {
    this.formEvents();
    return validateEventDraft(this.form.getRawValue(), this.text(), this.original);
  });
  readonly sections = signal<string[]>(['general', 'schedule', 'content']);
  readonly statusOptions = computed(() =>
    eventStatuses.map((value) => ({ value, label: this.statusLabel(value) })),
  );
  readonly formatOptions = computed(() =>
    eventFormats.map((value) => ({ value, label: this.formatLabel(value) })),
  );
  readonly format = computed(() => {
    this.formEvents();
    return this.form.controls.format.value;
  });
  readonly selectedVenue = computed(() => {
    this.formEvents();
    return this.form.controls.venueId.value ? [this.form.controls.venueId.value] : [];
  });
  readonly selectedTags = computed(() => {
    this.formEvents();
    return this.form.controls.tagIds.value;
  });
  private readonly description = viewChild<DescriptionEditor>('description');
  private readonly descriptionFocusPending = signal(false);
  readonly venueLoader: RelationLoader = (request) =>
    this.api
      .watchVenues({
        ...request,
        limit: request.ids ? 100 : 20,
        sort: { field: 'NAME', direction: 'ASC' },
      })
      .valueChanges.pipe(
        filter((result) => !result.loading),
        map((result) => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') throw new Error('Missing Venues result.');
          return result.data.referenceVenues;
        }),
      );
  readonly tagLoader: RelationLoader = (request) =>
    this.api
      .watchTags({
        ...request,
        limit: request.ids ? 100 : 20,
        sort: { field: 'NAME', direction: 'ASC' },
      })
      .valueChanges.pipe(
        filter((result) => !result.loading),
        map((result) => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') throw new Error('Missing Tags result.');
          return result.data.referenceTags;
        }),
      );
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly pending = signal(false);
  private readonly readError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  readonly error = computed(() => this.writeError() ?? this.readError());
  readonly retryAvailable = computed(() => this.readError() !== null && this.writeError() === null);
  readonly invalidId = computed(() => {
    const id = this.eventId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => eventFieldErrors(this.writeError()));
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'events',
  ]);

  constructor() {
    effect(() => {
      const description = this.description();
      if (!description || !this.descriptionFocusPending()) return;
      requestAnimationFrame(() => {
        if (this.destroyRef.destroyed || !this.descriptionFocusPending()) return;
        this.descriptionFocusPending.set(false);
        description.focus();
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.form.addValidators(() =>
      Object.keys(validateEventDraft(this.form.getRawValue(), this.text(), this.original)).length
        ? { event: true }
        : null,
    );
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    const id = this.eventId();
    if (id && !this.invalidId()) this.mediaApi.initialize(this.store().id, this.language(), id);
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      this.query = this.api.watchEvent(id);
      this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.readError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error && !this.ready()) {
            this.hydrate(result.data.referenceEvent);
            this.ready.set(true);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.readError.set(error);
        },
      });
    }
  }

  private hydrate(event: AdminEventDetailsFragment): void {
    this.original = event;
    this.form.reset(eventDraft(event));
  }
  statusLabel(status: EventDraft['status']): string {
    return status === 'PUBLISHED'
      ? this.text().eventPublished
      : status === 'ARCHIVED'
        ? this.text().eventArchived
        : this.text().eventDraft;
  }
  formatLabel(format: EventDraft['format']): string {
    return format === 'ONLINE'
      ? this.text().eventOnline
      : format === 'HYBRID'
        ? this.text().eventHybrid
        : this.text().eventInPerson;
  }
  fieldError(field: EventField): string {
    this.formEvents();
    return (
      this.serverErrors()[field] ??
      (this.form.controls[field].touched ? (this.clientErrors()[field] ?? '') : '')
    );
  }
  changeSections(value: unknown): void {
    if (Array.isArray(value))
      this.sections.set(
        value.filter((value: unknown): value is string => typeof value === 'string'),
      );
  }
  selectVenue(ids: string[]): void {
    this.form.controls.venueId.setValue(ids[0] ?? '');
    this.form.controls.venueId.markAsDirty();
    this.form.controls.venueId.markAsTouched();
  }
  selectTags(ids: string[]): void {
    this.form.controls.tagIds.setValue(ids);
    this.form.controls.tagIds.markAsDirty();
    this.form.controls.tagIds.markAsTouched();
  }
  private focusField(field: EventField): void {
    this.descriptionFocusPending.set(false);
    const section = [
      'startsAt',
      'endsAt',
      'registrationOpensOn',
      'registrationClosesOn',
      'venueId',
      'meetingUrl',
    ].includes(field)
      ? 'schedule'
      : ['summary', 'descriptionHtml', 'tagIds'].includes(field)
        ? 'content'
        : 'general';
    if (!this.sections().includes(section)) this.sections.update((value) => [...value, section]);
    // Expand the panel before moving focus; cancel the callback if this editor retires.
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed) return;
      if (field === 'descriptionHtml') {
        const description = this.description();
        if (description) description.focus();
        else this.descriptionFocusPending.set(true);
      } else
        this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#event-${field}`)?.focus();
    });
  }

  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.readError.set(error);
    });
  }

  async save(): Promise<void> {
    if (!this.ready() || this.pending() || this.galleryBusy()) return;
    this.form.markAllAsTouched();
    const values = this.form.getRawValue();
    const errors = validateEventDraft(values, this.text(), this.original);
    const first = eventFields.find((field) => errors[field]);
    if (first) {
      this.focusField(first);
      return;
    }
    const input: CreateReferenceEventInput = eventInput(values, this.original);
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: EventField | undefined;
    try {
      const id = this.eventId();
      let event: AdminEventDetailsFragment;
      if (id === null) event = await this.api.create({ input });
      else {
        if (!this.original) throw new Error('An existing Event must be loaded before updating.');
        event = await this.api.update({ id, input: eventUpdateInput(values, this.original) });
      }
      if (this.destroyRef.destroyed) return;
      this.hydrate(event);
      await this.router.navigate([...this.listLink(), event.id, ...(id === null ? ['edit'] : [])], {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { eventSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = eventFieldErrors(error);
        invalidField = eventFields.find((field) => fields[field]);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.pending.set(false);
        this.form.enable({ emitEvent: false });
        if (invalidField) this.focusField(invalidField);
      }
    }
  }

  routerBack(): void {
    void this.router.navigate(this.listLink(), {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  canLeave(): boolean | Promise<boolean> {
    if ((!this.form.dirty || this.pending()) && !this.gallery()?.dirty()) return true;
    if (!this.leaveDecision)
      this.leaveDecision = new Promise<boolean>((resolve) => {
        const settle = (leave: boolean) => {
          this.leaveDecision = undefined;
          resolve(leave);
        };
        this.confirmation.confirm({
          header: this.text().unsavedTitle,
          message: this.text().unsavedDescription,
          rejectButtonProps: {
            label: this.text().keepEditing,
            severity: 'secondary',
            outlined: true,
          },
          acceptButtonProps: { label: this.text().discardChanges, severity: 'danger' },
          accept: () => {
            this.gallery()?.discardDrafts();
            settle(true);
          },
          reject: () => {
            settle(false);
          },
        });
      });
    return this.leaveDecision;
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty && !this.pending()) event.preventDefault();
  }
}
