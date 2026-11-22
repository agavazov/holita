import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { injectCustomerRecord } from './customer-record';
import { CustomersApi } from './customers-api';

const fields = ['name', 'phone'] as const;
type ContactField = (typeof fields)[number];

@Component({
  selector: 'holita-customer-contact-editor',
  imports: [ButtonDirective, FormField, InputText, Message, ReactiveFormsModule, RouteDrawer],
  templateUrl: './customer-contact-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactEditor {
  private readonly api = inject(CustomersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage).value;
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = injectDrawerHost();
  private readonly context = injectCustomerRecord(
    this.route.parent ?? this.route,
    this.api.canWrite,
  );
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly drawer = viewChild.required(RouteDrawer);
  protected readonly closeLink = this.host.closeLink ?? ['..'];
  protected readonly record = this.context.record;
  protected readonly scope = this.api.scope;
  protected readonly canWrite = this.api.canWrite;
  protected readonly customer = computed(() => this.context.profile()?.customer ?? null);
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly serverErrors = signal<Partial<Record<ContactField, string>>>({});
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    phone: new FormControl('', { nonNullable: true, validators: [textValidator(50)] }),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.canWrite()) {
      return 'ready';
    }
    if (!this.context.validId()) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return this.customer() ? 'ready' : 'not-found';
  });

  constructor() {
    effect(() => {
      this.context.params();
      const customer = this.customer();
      this.form.reset(
        { name: customer?.name ?? '', phone: customer?.phone ?? '' },
        { emitEvent: false },
      );
      this.serverErrors.set({});
      this.saveError.set(false);
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected fieldError(field: ContactField): string | null {
    const control = this.form.controls[field];
    return (
      this.serverErrors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(field: ContactField): void {
    this.serverErrors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.context.params();
    if (!params || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    if (this.form.invalid) {
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
      const recordId = await this.api.updateContact(
        params.scope,
        params.id,
        this.form.getRawValue(),
      );
      if (this.destroyRef.destroyed || this.context.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().customerContactSaved, recordId });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.context.params() !== params) {
        return;
      }
      const errors = fieldErrors(error, fields, params.scope.language);
      this.serverErrors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'customer-contact-')) {
      this.drawer().focusTitle();
    }
  }
}
