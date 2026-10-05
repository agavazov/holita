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
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type {
  AdminStoresQuery,
  CreateProductInput,
  ProductStatus,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, type Language } from '../../i18n/messages';
import { ProductsApi } from './products-api';
import { productStatus, productText } from './product-validation';

@Component({
  selector: 'holita-product-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Message,
    Select,
  ],
  providers: [ProductsApi, ConfirmationService],
  templateUrl: './product-editor.html',
  styleUrl: './product-editor.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class ProductEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly productId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly skuInput = viewChild<ElementRef<HTMLInputElement>>('skuInput');
  private query: ReturnType<ProductsApi['watchProduct']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: productText(200) }),
    sku: new FormControl('', { nonNullable: true, validators: productText(100) }),
    status: new FormControl<ProductStatus>('DRAFT', {
      nonNullable: true,
      validators: productStatus,
    }),
  });
  private readonly formEvents = toSignal(this.form.events);
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly error = signal<unknown>(null);
  readonly invalidId = computed(() => {
    const id = this.productId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly statusOptions = computed(() => [
    { label: this.text().draft, value: 'DRAFT' },
    { label: this.text().active, value: 'ACTIVE' },
  ]);
  readonly listLink = computed(() => ['/', this.language(), 'stores', this.store().id, 'products']);

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    const id = this.productId();
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      const query = this.api.watchProduct(id);
      this.query = query;
      query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          // Hydrate once: cache notifications and retry results must never overwrite local edits.
          if (result.dataState === 'complete' && !this.ready()) {
            const product = result.data.product;
            this.form.reset({ name: product.name, sku: product.sku, status: product.status });
            this.ready.set(true);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error);
        },
      });
    }
  }

  fieldError(field: 'name' | 'sku' | 'status'): string {
    this.formEvents();
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required'))
      return field === 'name' ? this.text().nameRequired : this.text().skuRequired;
    if (control.hasError('unsupported')) return this.text().unsupportedCharacters;
    if (control.hasError('maxLength'))
      return this.text().maxCharacters.replace('{max}', field === 'name' ? '200' : '100');
    return this.text().invalidStatus;
  }

  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.error.set(error);
    });
  }

  async save(): Promise<void> {
    if (!this.ready() || this.pending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.controls.name.invalid) this.nameInput()?.nativeElement.focus();
      else if (this.form.controls.sku.invalid) this.skuInput()?.nativeElement.focus();
      return;
    }
    const values = this.form.getRawValue();
    const input: CreateProductInput = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      status: values.status,
    };
    this.pending.set(true);
    this.error.set(null);
    this.form.disable();
    try {
      const id = this.productId();
      const product =
        id === null ? await this.api.create({ input }) : await this.api.update({ id, input });
      if (this.destroyRef.destroyed) return;
      this.form.reset({ name: product.name, sku: product.sku, status: product.status });
      await this.router.navigate(this.listLink(), {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { productSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.error.set(error);
    } finally {
      if (!this.destroyRef.destroyed) {
        this.pending.set(false);
        this.form.enable();
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
