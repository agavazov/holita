import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  UI_LANGUAGE,
  dateTimeInputInstants,
  displayTimeZone,
  drawerRouteData,
  errorCode,
  fieldErrors,
  focusFirstInvalid,
  formatDateTimeInput,
  injectDrawerHost,
  lockWhileSaving,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { LeadDetailPage } from './lead-detail-page';
import { LeadNotesApi } from './lead-notes-api';
import { leadLabel } from './lead-record';
import { leadStrings } from './lead-strings';
import { leadTimeOffsets, leadUtcOffset } from './lead-time';

const fields = ['occurredAt', 'text'] as const;
type NoteField = (typeof fields)[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

@Component({
  selector: 'holita-lead-note-editor',
  imports: [
    RouteDrawer,
    ReactiveFormsModule,
    FormField,
    InputText,
    Select,
    Textarea,
    ButtonDirective,
    Message,
  ],
  templateUrl: './lead-note-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadNoteEditor {
  private readonly api = inject(LeadNotesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  private readonly parentRecord = inject(LeadDetailPage).entry;
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly parentParams = toSignal(this.route.parent?.paramMap ?? this.route.paramMap, {
    requireSync: true,
  });
  private readonly leadId = computed(() => this.parentParams().get('recordId'));
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly noteId = computed(() =>
    this.editing ? this.params().get(this.routeData.recordParam ?? 'recordId') : null,
  );
  private readonly validNoteId = computed(() => uuid.test(this.noteId() ?? ''));
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const lead = this.parentRecord.lead();
      const id = this.noteId();
      return scope && lead && lead.id === this.leadId()?.toLowerCase() && id && this.validNoteId()
        ? { scope, leadId: lead.id, id }
        : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.find(params.scope, params.leadId, params.id, abortSignal),
  });
  private readonly initialInstant = computed(() => {
    if (this.editing) {
      return this.record.hasValue() ? this.record.value()?.occurredAt : undefined;
    }
    return this.leadId() ? new Date().toISOString() : undefined;
  });

  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly closeLink = computed(() => ['/', this.language(), 'leads', this.leadId()]);
  protected readonly subtitle = computed(() => {
    const lead = this.parentRecord.lead();
    return lead ? leadLabel(lead) : null;
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.parentRecord.validId() || (this.editing && !this.validNoteId())) {
      return 'invalid-id';
    }
    if (this.parentRecord.record.isLoading() || this.record.isLoading()) {
      return 'loading';
    }
    if (this.parentRecord.record.error() || this.record.error()) {
      return 'error';
    }
    if (
      !this.parentRecord.lead() ||
      (this.editing && !(this.record.hasValue() && this.record.value()))
    ) {
      return 'not-found';
    }
    return 'ready';
  });
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saveLabel = computed(() => operatorStrings[this.language()].save);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly errors = signal<Partial<Record<NoteField, string>>>({});
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly form = this.formBuilder.group({
    occurredAt: this.formBuilder.control('', (control) => Validators.required(control)),
    offset: this.formBuilder.control(''),
    text: this.formBuilder.control('', (control) => Validators.required(control)),
  });
  private readonly occurredAt = toSignal(this.form.controls.occurredAt.valueChanges, {
    initialValue: '',
  });
  private readonly instants = computed(() =>
    dateTimeInputInstants(this.occurredAt().trim(), displayTimeZone),
  );
  protected readonly offsets = computed(() => leadTimeOffsets(this.instants()));

  constructor() {
    effect(() => {
      const iso = this.initialInstant();
      this.form.reset({
        occurredAt: formatDateTimeInput(iso, displayTimeZone).replace(/\.000$/u, ''),
        offset: iso ? leadUtcOffset(Date.parse(iso)) : '',
        text: this.record.hasValue() ? (this.record.value()?.text ?? '') : '',
      });
      this.errors.set({});
      this.saveError.set(null);
    });
    effect(() => {
      const options = this.offsets();
      const control = this.form.controls.offset;
      const selected = options.find(({ label }) => label === control.value) ?? options[0];
      control.setValue(selected?.label ?? '');
    });
    lockWhileSaving(this.form, this.saving, () => {
      if (this.saveError() || Object.keys(this.errors()).length) {
        this.focusError();
      }
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected retry(): void {
    if (this.parentRecord.record.error()) {
      this.parentRecord.record.reload();
    } else {
      this.record.reload();
    }
  }

  protected fieldError(field: NoteField): string | null {
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(field: NoteField): void {
    this.errors.update(({ [field]: _error, ...remaining }) => remaining);
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    const lead = this.parentRecord.lead();
    if (!scope || !lead || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(null);
    const values = this.form.getRawValue();
    const text = values.text.trim();
    const instant =
      this.offsets().find(({ label }) => label === values.offset)?.instant ?? this.instants()[0];
    this.errors.set({
      ...(!text ? { text: this.text().noteRequired } : {}),
      ...(values.occurredAt && instant === undefined
        ? { occurredAt: this.text().noteInvalidTime }
        : {}),
    });
    if (!text || instant === undefined) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    this.saving.set(true);
    try {
      await this.api.save(scope, lead.id, this.noteId(), {
        text,
        occurredAt: new Date(instant).toISOString(),
      });
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().noteSaved, recordId: null });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code, field) =>
        code === 'INVALID_VALUE' && field === 'occurredAt'
          ? this.text().noteInvalidTime
          : undefined,
      );
      this.errors.set(errors);
      if (!Object.keys(errors).length) {
        this.saveError.set(
          errorCode(error) === 'NOT_FOUND' ? this.text().noteNotFound : this.text().noteSaveFailed,
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'note-')) {
      this.drawer().focusTitle();
    }
  }
}
