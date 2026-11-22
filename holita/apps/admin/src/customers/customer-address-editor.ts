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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  patternValidator,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { customerRecordIdPattern, injectCustomerRecord } from './customer-record';
import { CustomersApi } from './customers-api';

const fields = [
  { name: 'recipient', label: 'addressRecipient', autocomplete: 'name', wide: true },
  { name: 'line1', label: 'addressStreet', autocomplete: 'address-line1', wide: true },
  { name: 'city', label: 'orderCity', autocomplete: 'address-level2', wide: false },
  { name: 'postalCode', label: 'orderPostalCode', autocomplete: 'postal-code', wide: false },
  { name: 'countryCode', label: 'orderCountryCode', autocomplete: 'country', wide: false },
] as const;
type AddressField = (typeof fields)[number]['name'];
const fieldNames = fields.map(({ name }) => name);

function addressText(max: number) {
  return new FormControl('', {
    nonNullable: true,
    validators: [textValidator(max, { required: true })],
  });
}

@Component({
  selector: 'holita-customer-address-editor',
  imports: [ButtonDirective, FormField, InputText, Message, ReactiveFormsModule, RouteDrawer],
  templateUrl: './customer-address-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressEditor {
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
  private readonly routeData = drawerRouteData(this.route);
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly addressId = computed(() =>
    this.editing ? this.routeParams().get(this.routeData.recordParam ?? 'recordId') : null,
  );
  private readonly address = computed(() =>
    this.context.profile()?.addresses.find(({ id }) => id === this.addressId()?.toLowerCase()),
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
  private readonly serverErrors = signal<Partial<Record<AddressField, string>>>({});
  protected readonly fields = fields;
  protected readonly form = new FormGroup({
    recipient: addressText(200),
    line1: addressText(200),
    city: addressText(120),
    postalCode: addressText(20),
    countryCode: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(2, { required: true }), patternValidator(/^[a-z]{2}$/i)],
    }),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.canWrite()) {
      return 'ready';
    }
    if (
      !this.context.validId() ||
      (this.editing && !customerRecordIdPattern.test(this.addressId() ?? ''))
    ) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return this.customer() && (!this.editing || this.address()) ? 'ready' : 'not-found';
  });

  constructor() {
    effect(() => {
      this.context.params();
      this.addressId();
      const address = this.address();
      this.form.reset(
        {
          recipient: address?.recipient ?? '',
          line1: address?.line1 ?? '',
          city: address?.city ?? '',
          postalCode: address?.postalCode ?? '',
          countryCode: address?.countryCode ?? '',
        },
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

  protected fieldError(field: AddressField): string | null {
    const control = this.form.controls[field];
    return (
      this.serverErrors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(field: AddressField): void {
    this.serverErrors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.context.params();
    const addressId = this.addressId();
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
      await this.api.saveAddress(params.scope, params.id, addressId, this.form.getRawValue());
      if (
        this.destroyRef.destroyed ||
        this.context.params() !== params ||
        this.addressId() !== addressId
      ) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().customerAddressSaved, recordId: params.id });
      this.drawer().close();
    } catch (error: unknown) {
      if (
        this.destroyRef.destroyed ||
        this.context.params() !== params ||
        this.addressId() !== addressId
      ) {
        return;
      }
      const errors = fieldErrors(error, fieldNames, params.scope.language);
      this.serverErrors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fieldNames, 'customer-address-')) {
      this.drawer().focusTitle();
    }
  }
}
