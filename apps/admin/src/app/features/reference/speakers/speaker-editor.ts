import {
  Component,
  computed,
  DestroyRef,
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
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Message } from 'primeng/message';
import type {
  AdminStoresQuery,
  AdminSpeakerFragment,
  CreateReferenceSpeakerInput,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { SpeakersApi } from './speakers-api';
import {
  speakerActive,
  speakerEmail,
  speakerFieldErrors,
  speakerFields,
  speakerText,
  type SpeakerField,
} from './speaker-validation';

@Component({
  selector: 'holita-speaker-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Textarea,
    ToggleSwitch,
    Message,
  ],
  providers: [SpeakersApi, ConfirmationService],
  templateUrl: './speaker-editor.html',
  styleUrl: '../reference-editor.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class SpeakerEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly speakerId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(SpeakersApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private query: ReturnType<SpeakersApi['watchSpeaker']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: speakerText(200, true) }),
    email: new FormControl('', { nonNullable: true, validators: [speakerText(254), speakerEmail] }),
    shortBio: new FormControl('', { nonNullable: true, validators: speakerText(2000) }),
    active: new FormControl(true, { nonNullable: true, validators: speakerActive }),
  });
  private readonly formEvents = toSignal(this.form.events);
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly pending = signal(false);
  private readonly readError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  readonly error = computed(() => this.writeError() ?? this.readError());
  readonly retryAvailable = computed(() => this.readError() !== null && this.writeError() === null);
  readonly invalidId = computed(() => {
    const id = this.speakerId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => speakerFieldErrors(this.writeError()));
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'speakers',
  ]);

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    const id = this.speakerId();
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      this.query = this.api.watchSpeaker(id);
      this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.readError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error && !this.ready()) {
            this.hydrate(result.data.referenceSpeaker);
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

  private hydrate(speaker: AdminSpeakerFragment): void {
    this.form.reset({
      name: speaker.name,
      email: speaker.email ?? '',
      shortBio: speaker.shortBio ?? '',
      active: speaker.active,
    });
  }

  fieldError(field: SpeakerField): string {
    this.formEvents();
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return this.text().nameRequired;
    if (control.hasError('unsupported')) return this.text().unsupportedCharacters;
    if (control.hasError('maxLength')) {
      const max = field === 'name' ? 200 : field === 'email' ? 254 : 2000;
      return this.text().maxCharacters.replace('{max}', String(max));
    }
    return control.hasError('email') ? this.text().invalidEmail : this.text().invalidActive;
  }

  private focusField(field: SpeakerField): void {
    this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#speaker-${field}`)?.focus();
  }

  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.readError.set(error);
    });
  }

  async save(): Promise<void> {
    if (!this.ready() || this.pending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const first = speakerFields.find((field) => this.form.controls[field].invalid);
      if (first) this.focusField(first);
      return;
    }
    const values = this.form.getRawValue();
    const input: CreateReferenceSpeakerInput = {
      name: values.name.trim(),
      email: values.email.trim() || null,
      shortBio: values.shortBio.trim() || null,
      active: values.active,
    };
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: SpeakerField | undefined;
    try {
      const id = this.speakerId();
      const speaker =
        id === null ? await this.api.create({ input }) : await this.api.update({ id, input });
      if (this.destroyRef.destroyed) return;
      this.hydrate(speaker);
      await this.router.navigate(this.listLink(), {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { speakerSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = speakerFieldErrors(error);
        invalidField = speakerFields.find((field) => fields[field]);
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
