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
  AdminVenueFragment,
  CreateReferenceVenueInput,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { VenuesApi } from './venues-api';
import {
  venueActive,
  venueCapacity,
  venueCountry,
  venueFieldErrors,
  venueFields,
  venueText,
  venueTextLimits,
  type VenueField,
} from './venue-validation';

@Component({
  selector: 'holita-venue-editor',
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
  providers: [VenuesApi, ConfirmationService],
  templateUrl: './venue-editor.html',
  styleUrl: '../reference-editor.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class VenueEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly venueId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(VenuesApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private query: ReturnType<VenuesApi['watchVenue']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: venueText(200, true) }),
    description: new FormControl('', { nonNullable: true, validators: venueText(2000) }),
    city: new FormControl('', { nonNullable: true, validators: venueText(120, true) }),
    countryCode: new FormControl('BG', { nonNullable: true, validators: venueCountry }),
    address: new FormControl('', { nonNullable: true, validators: venueText(300) }),
    capacity: new FormControl<number | null>(null, { validators: venueCapacity }),
    active: new FormControl(true, { nonNullable: true, validators: venueActive }),
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
    const id = this.venueId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => venueFieldErrors(this.writeError()));
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'venues',
  ]);

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    const id = this.venueId();
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      this.query = this.api.watchVenue(id);
      this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.readError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error && !this.ready()) {
            this.hydrate(result.data.referenceVenue);
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

  private hydrate(venue: AdminVenueFragment): void {
    this.form.reset({
      name: venue.name,
      description: venue.description ?? '',
      city: venue.city,
      countryCode: venue.countryCode,
      address: venue.address ?? '',
      capacity: venue.capacity ?? null,
      active: venue.active,
    });
  }

  fieldError(field: VenueField): string {
    this.formEvents();
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required'))
      return field === 'name' ? this.text().nameRequired : this.text().cityRequired;
    if (control.hasError('unsupported')) return this.text().unsupportedCharacters;
    if (control.hasError('maxLength') && field in venueTextLimits) {
      const max =
        field === 'name' ? 200 : field === 'city' ? 120 : field === 'description' ? 2000 : 300;
      return this.text().maxCharacters.replace('{max}', String(max));
    }
    return field === 'countryCode'
      ? this.text().invalidCountryCode
      : field === 'capacity'
        ? this.text().invalidCapacity
        : this.text().invalidActive;
  }

  private focusField(field: VenueField): void {
    this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#venue-${field}`)?.focus();
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
      const first = venueFields.find((field) => this.form.controls[field].invalid);
      if (first) this.focusField(first);
      return;
    }
    const values = this.form.getRawValue();
    const input: CreateReferenceVenueInput = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      city: values.city.trim(),
      countryCode: values.countryCode.trim().toUpperCase(),
      address: values.address.trim() || null,
      capacity: values.capacity,
      active: values.active,
    };
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: VenueField | undefined;
    try {
      const id = this.venueId();
      const venue =
        id === null ? await this.api.create({ input }) : await this.api.update({ id, input });
      if (this.destroyRef.destroyed) return;
      this.hydrate(venue);
      await this.router.navigate(this.listLink(), {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { venueSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = venueFieldErrors(error);
        invalidField = venueFields.find((field) => fields[field]);
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
