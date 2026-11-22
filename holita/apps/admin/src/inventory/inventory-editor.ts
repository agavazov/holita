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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  formatNumber,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  toneSeverity,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { InventoryApi } from './inventory-api';
import { variantLabel } from './variant-label';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxQuantity = 2_147_483_647;

@Component({
  selector: 'holita-inventory-editor',
  imports: [ButtonDirective, FormField, InputText, Message, ReactiveFormsModule, RouteDrawer, Tag],
  templateUrl: './inventory-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryEditor {
  private readonly api = inject(InventoryApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly id = computed(() => this.params().get(this.routeData.recordParam ?? 'recordId'));
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly variant = computed(() =>
    this.record.hasValue() ? this.record.value() : null,
  );
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || this.record.error()) {
      return 'error';
    }
    if (!uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    return this.variant() ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly label = computed(() => {
    const variant = this.variant();
    return variant ? variantLabel(variant, this.text().defaultVariant) : null;
  });
  protected readonly canAdjust = computed(
    () => this.session.hasRole('OPERATOR') && !!this.variant()?.inventoryTracked,
  );
  protected readonly tone = toneSeverity;
  protected readonly maxQuantity = maxQuantity;
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly serverError = signal<string | null>(null);
  protected readonly form = new FormGroup({
    quantity: new FormControl<number | null>(null, {
      validators: [integerValidator(0, maxQuantity, { required: true })],
    }),
  });

  constructor() {
    effect(() => {
      this.form.reset({ quantity: this.variant()?.quantity ?? null }, { emitEvent: false });
      this.clearError();
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

  protected quantityText(value: number | null): string {
    return formatNumber(value, this.language.value());
  }

  protected quantityError(): string | null {
    const control = this.form.controls.quantity;
    return (
      this.serverError() ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected clearError(): void {
    this.serverError.set(null);
    this.saveError.set(false);
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    const variant = this.variant();
    if (!scope || !variant || !this.canAdjust() || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.clearError();
    const { quantity } = this.form.getRawValue();
    if (this.form.invalid || quantity === null) {
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
      const id = await this.api.save(scope, variant.id, quantity);
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().inventoryQuantitySaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const { quantity: message } = fieldErrors(error, ['quantity'], scope.language, (code) =>
        code === 'INVENTORY_TRACKING_REQUIRED' ? this.text().inventoryTrackingRequired : undefined,
      );
      this.serverError.set(message ?? null);
      this.saveError.set(!message);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, ['quantity'], 'inventory-')) {
      this.drawer().focusTitle();
    }
  }
}
