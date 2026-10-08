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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Message } from 'primeng/message';
import type {
  AdminStoresQuery,
  AdminTagFragment,
  CreateReferenceTagInput,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { TagsApi } from './tags-api';
import {
  tagActive,
  tagColor,
  tagFieldErrors,
  tagFields,
  tagText,
  type TagField,
} from './tag-validation';

@Component({
  selector: 'holita-tag-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    ToggleSwitch,
    Message,
  ],
  providers: [TagsApi, ConfirmationService],
  templateUrl: './tag-editor.html',
  styleUrl: '../reference-editor.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class TagEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly tagId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(TagsApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private query: ReturnType<TagsApi['watchTag']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: tagText(100, true) }),
    color: new FormControl('#315ed0', { nonNullable: true, validators: tagColor }),
    active: new FormControl(true, { nonNullable: true, validators: tagActive }),
  });
  private readonly formEvents = toSignal(this.form.events);
  readonly colorPreview = computed(() => {
    this.formEvents();
    const value = this.form.controls.color.value.trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
  });
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly pending = signal(false);
  private readonly readError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  readonly error = computed(() => this.writeError() ?? this.readError());
  readonly retryAvailable = computed(() => this.readError() !== null && this.writeError() === null);
  readonly invalidId = computed(() => {
    const id = this.tagId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => tagFieldErrors(this.writeError()));
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'tags',
  ]);

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    const id = this.tagId();
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      this.query = this.api.watchTag(id);
      this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.readError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error && !this.ready()) {
            this.hydrate(result.data.referenceTag);
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

  private hydrate(tag: AdminTagFragment): void {
    this.form.reset({
      name: tag.name,
      color: tag.color,
      active: tag.active,
    });
  }

  fieldError(field: TagField): string {
    this.formEvents();
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return this.text().nameRequired;
    if (control.hasError('unsupported')) return this.text().unsupportedCharacters;
    if (control.hasError('maxLength')) {
      const max = 100;
      return this.text().maxCharacters.replace('{max}', String(max));
    }
    return control.hasError('color') ? this.text().invalidColor : this.text().invalidActive;
  }

  private focusField(field: TagField): void {
    this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#tag-${field}`)?.focus();
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
      const first = tagFields.find((field) => this.form.controls[field].invalid);
      if (first) this.focusField(first);
      return;
    }
    const values = this.form.getRawValue();
    const input: CreateReferenceTagInput = {
      name: values.name.trim(),
      color: values.color.trim().toLowerCase(),
      active: values.active,
    };
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: TagField | undefined;
    try {
      const id = this.tagId();
      const tag =
        id === null ? await this.api.create({ input }) : await this.api.update({ id, input });
      if (this.destroyRef.destroyed) return;
      this.hydrate(tag);
      await this.router.navigate(this.listLink(), {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { tagSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = tagFieldErrors(error);
        invalidField = tagFields.find((field) => fields[field]);
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
