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
import { ReactiveFormsModule } from '@angular/forms';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  RouteDrawer,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  uiMessages,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  InvoiceIssuerFields,
  invoiceIssuerForm,
  issuerFieldKeys,
  issuerFormValues,
  type IssuerField,
} from './invoice-issuer-fields';
import { OrdersApi } from './orders-api';

@Component({
  selector: 'holita-invoice-issuer-settings',
  imports: [ButtonDirective, InvoiceIssuerFields, Message, ReactiveFormsModule, RouteDrawer],
  templateUrl: './invoice-issuer-settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceIssuerSettings {
  private readonly api = inject(OrdersApi);
  private readonly host = injectDrawerHost();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(OperatorLanguage).value;
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('settingsForm');
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly drawer = viewChild.required(RouteDrawer);
  protected readonly canWrite = this.api.canWrite;
  protected readonly record = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.api.issuerSettings(params),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || this.record.error()) {
      return 'error';
    }
    return this.record.hasValue() ? 'ready' : 'loading';
  });
  protected readonly form = invoiceIssuerForm();
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly errors = signal<Partial<Record<IssuerField, string>>>({});

  constructor() {
    effect(() => {
      this.form.reset(this.record.hasValue() ? issuerFormValues(this.record.value()) : undefined);
      this.errors.set({});
      this.saveError.set(false);
    });
    lockWhileSaving(this.form, this.saving, () => {
      this.focusError();
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected clearError(field: IssuerField): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || !this.canWrite() || this.state() !== 'ready' || this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
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
      await this.api.saveIssuerSettings(scope, this.form.getRawValue());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().invoiceSettingsSaved, recordId: null });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, issuerFieldKeys, scope.language);
      this.errors.set(errors);
      this.saveError.set(Object.keys(errors).length === 0);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, issuerFieldKeys, 'invoice-')) {
      this.drawer().focusTitle();
    }
  }
}
