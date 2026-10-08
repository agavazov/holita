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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Message } from 'primeng/message';
import { filter, map } from 'rxjs';
import { SessionsApi } from '../sessions-api';
import {
  sessionDraft,
  sessionFields,
  sessionInput,
  sessionFieldErrors,
  validateSessionDraft,
  type SessionField,
} from '../session-form';
import { messages, type Language } from '../../../../i18n/messages';
import { requestError } from '../../../../core/graphql/request-error';
import { eventTime, formatEventTime } from '../../events/event-time';
import { RelationPicker, type RelationLoader } from '../../relation-picker';
import type {
  AdminStoresQuery,
  AdminEventDetailsFragment,
  AdminSessionDetailsFragment,
} from '../../../../../generated/graphql/operations';
@Component({
  selector: 'holita-session-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialog,
    ButtonDirective,
    InputText,
    Textarea,
    Message,
    RelationPicker,
  ],
  providers: [SessionsApi, ConfirmationService],
  templateUrl: './session-editor.html',
  styleUrls: ['../../reference-editor.scss', './session-editor.scss'],
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class SessionEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly eventId = input.required<string>();
  readonly sessionId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  readonly event = signal<AdminEventDetailsFragment | null>(null);
  readonly ready = signal(false);
  private readonly eventLoading = signal(true);
  private readonly sessionLoading = signal(false);
  readonly loading = computed(() => this.eventLoading() || this.sessionLoading());
  readonly pending = signal(false);
  private readonly eventError = signal<unknown>(null);
  private readonly sessionError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  readonly error = computed(() => this.writeError() ?? this.sessionError() ?? this.eventError());
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => sessionFieldErrors(this.writeError()));
  readonly retryAvailable = computed(
    () =>
      this.writeError() === null && (this.eventError() !== null || this.sessionError() !== null),
  );
  readonly invalidId = computed(() =>
    [this.eventId(), this.sessionId()].some(
      (id) =>
        id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    ),
  );
  readonly overviewLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'events',
    this.eventId(),
  ]);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    summary: new FormControl('', { nonNullable: true }),
    room: new FormControl('', { nonNullable: true }),
    startsAt: new FormControl('', { nonNullable: true }),
    endsAt: new FormControl('', { nonNullable: true }),
    speakerIds: new FormControl<string[]>([], { nonNullable: true }),
  });
  private readonly formEvents = toSignal(this.form.events);
  readonly selectedSpeakers = computed(() => {
    this.formEvents();
    return this.form.controls.speakerIds.value;
  });
  private readonly api = inject(SessionsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private original: AdminSessionDetailsFragment | undefined;
  private eventQuery: ReturnType<SessionsApi['watchEvent']> | undefined;
  private sessionQuery: ReturnType<SessionsApi['watchSession']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly speakerLoader: RelationLoader = (request) =>
    this.api
      .watchSpeakers({
        ...request,
        limit: request.ids ? 100 : 20,
        sort: { field: 'NAME', direction: 'ASC' },
      })
      .valueChanges.pipe(
        filter((result) => !result.loading),
        map((result) => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') throw new Error('Missing Speakers result.');
          return result.data.referenceSpeakers;
        }),
      );
  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language(), this.eventId());
    this.form.addValidators(() => {
      const event = this.event();
      return event &&
        Object.keys(
          validateSessionDraft(this.form.getRawValue(), event, this.text(), this.original),
        ).length
        ? { session: true }
        : null;
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    if (this.invalidId()) {
      this.eventLoading.set(false);
      return;
    }
    this.eventQuery = this.api.watchEvent();
    this.eventQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.eventLoading.set(result.loading);
        this.eventError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.event.set(result.data.referenceEvent);
          if (!this.ready() && !this.sessionQuery) {
            const id = this.sessionId();
            if (id === null) {
              this.form.reset(sessionDraft(result.data.referenceEvent));
              this.ready.set(true);
            } else this.loadSession(id);
          }
        }
      },
      error: (error: unknown) => {
        this.eventLoading.set(false);
        this.eventError.set(error);
      },
    });
  }
  private loadSession(id: string): void {
    this.sessionLoading.set(true);
    this.sessionQuery = this.api.watchSession(id);
    this.sessionQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.sessionLoading.set(result.loading);
        this.sessionError.set(result.error ?? null);
        const event = this.event();
        if (result.dataState === 'complete' && !result.error && event && !this.ready()) {
          this.original = result.data.referenceSession;
          this.form.reset(sessionDraft(event, this.original));
          this.ready.set(true);
        }
      },
      error: (error: unknown) => {
        this.sessionLoading.set(false);
        this.sessionError.set(error);
      },
    });
  }
  date(value: string): string {
    return `${formatEventTime(value, this.language())} ${eventTime(value).format('Z')}`;
  }
  fieldError(field: SessionField): string {
    this.formEvents();
    const event = this.event();
    return (
      this.serverErrors()[field] ??
      (event && this.form.controls[field].touched
        ? (validateSessionDraft(this.form.getRawValue(), event, this.text(), this.original)[
            field
          ] ?? '')
        : '')
    );
  }
  selectSpeakers(ids: string[]): void {
    this.form.controls.speakerIds.setValue(ids);
    this.form.controls.speakerIds.markAsDirty();
    this.form.controls.speakerIds.markAsTouched();
  }
  private focusField(field: SessionField): void {
    requestAnimationFrame(() => {
      if (!this.destroyRef.destroyed)
        this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#session-${field}`)?.focus();
    });
  }
  retry(): void {
    void this.eventQuery?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.eventError.set(error);
    });
    void this.sessionQuery?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.sessionError.set(error);
    });
  }
  async save(): Promise<void> {
    const event = this.event();
    if (!event || !this.ready() || this.pending()) return;
    this.form.markAllAsTouched();
    const errors = validateSessionDraft(this.form.getRawValue(), event, this.text(), this.original),
      first = sessionFields.find((field) => errors[field]);
    if (first) {
      this.focusField(first);
      return;
    }
    const input = sessionInput(this.form.getRawValue(), event, this.original);
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: SessionField | undefined;
    try {
      const id = this.sessionId();
      const session = id === null ? await this.api.create(input) : await this.api.update(id, input);
      if (this.destroyRef.destroyed) return;
      this.original = session;
      this.form.reset(sessionDraft(event, session));
      await this.router.navigate(this.overviewLink(), {
        queryParams: { tab: 'sessions' },
        queryParamsHandling: 'merge',
        preserveFragment: true,
        state: { sessionSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = sessionFieldErrors(error);
        invalidField = sessionFields.find((field) => fields[field]);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.pending.set(false);
        this.form.enable({ emitEvent: false });
        if (invalidField) this.focusField(invalidField);
      }
    }
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.form.dirty || this.pending()) return true;
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
