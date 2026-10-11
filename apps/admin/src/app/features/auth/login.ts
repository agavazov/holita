import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, type UrlTree } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import type {
  AdminDemoLoginMutation,
  AdminStoresQuery,
  AdminTenantsQuery,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, type Language } from '../../i18n/messages';
import { Appearance } from '../../layout/appearance';
import { StoresApi } from '../stores/stores-api';

type Session = AdminDemoLoginMutation['demoLogin'];

@Component({
  selector: 'holita-login',
  imports: [RouterLink, ReactiveFormsModule, Select, ButtonDirective, Message, Moon, Sun],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  readonly language = input.required<Language>();
  readonly languageUrl = input.required<UrlTree>();
  readonly signedIn = output<{ session: Session; storeId: string }>();
  readonly text = computed(() => messages[this.language()]);
  readonly appearance = inject(Appearance);
  readonly tenantControl = new FormControl<string | null>(null);
  readonly storeControl = new FormControl<string | null>({ value: null, disabled: true });
  readonly form = new FormGroup({ tenant: this.tenantControl, store: this.storeControl });
  readonly tenants = signal<AdminTenantsQuery['tenants']>([]);
  readonly stores = signal<AdminStoresQuery['stores']>([]);
  readonly tenantsLoading = signal(true);
  readonly storesLoading = signal(false);
  readonly tenantError = signal<unknown>(null);
  readonly storeError = signal<unknown>(null);
  readonly failure = computed(() =>
    requestError(this.tenantError() ?? this.storeError(), this.text().networkError),
  );
  readonly submitted = signal(false);
  private readonly api = inject(StoresApi);
  private revision = 0;
  private preparedSession: Session | null = null;
  private closeStores: (() => void) | undefined;
  private closeTenants: (() => void) | undefined;

  constructor() {
    this.tenantControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      void this.loadStores(id, this.language());
    });
    effect((onCleanup) => {
      const language = this.language();
      this.loadTenants(language);
      void this.loadStores(this.tenantControl.value, language);
      onCleanup(() => {
        this.revision++;
        this.closeTenants?.();
        this.closeStores?.();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.revision++;
    });
  }

  private loadTenants(language: Language): void {
    this.closeTenants?.();
    this.tenantsLoading.set(true);
    this.tenantError.set(null);
    const query = this.api.tenants(language);
    const subscription = query.valueChanges.subscribe({
      next: (result) => {
        this.tenantsLoading.set(result.loading);
        this.tenantError.set(result.error ?? null);
        if (result.dataState === 'complete') this.tenants.set(result.data.tenants);
      },
      error: (error: unknown) => {
        this.tenantsLoading.set(false);
        this.tenantError.set(error);
      },
    });
    this.closeTenants = () => {
      subscription.unsubscribe();
    };
  }

  private async loadStores(tenantId: string | null, language: Language): Promise<void> {
    const revision = ++this.revision;
    this.closeStores?.();
    this.closeStores = undefined;
    this.preparedSession = null;
    this.storeControl.reset({ value: null, disabled: true });
    this.stores.set([]);
    this.storeError.set(null);
    this.storesLoading.set(!!tenantId);
    if (!tenantId) return;
    try {
      // A candidate token can only discover its tenant's stores; it is not an active UI session.
      const session = await this.api.login(tenantId, language);
      if (revision !== this.revision) return;
      const { query, close } = this.api.watch(language, {
        tenantId: session.tenant.id,
        token: session.token,
      });
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.storesLoading.set(result.loading);
          this.storeError.set(result.error ?? null);
          if (result.dataState === 'complete') {
            this.stores.set(result.data.stores);
            this.preparedSession = session;
            if (result.data.stores.length) this.storeControl.enable();
          }
        },
        error: (error: unknown) => {
          this.storesLoading.set(false);
          this.storeError.set(error);
        },
      });
      this.closeStores = () => {
        subscription.unsubscribe();
        close();
      };
    } catch (error) {
      if (revision === this.revision) {
        this.storesLoading.set(false);
        this.storeError.set(error);
      }
    }
  }

  retry(): void {
    if (this.tenantError()) this.loadTenants(this.language());
    else void this.loadStores(this.tenantControl.value, this.language());
  }

  login(): void {
    const session = this.preparedSession;
    const storeId = this.storeControl.value;
    if (
      !session ||
      !storeId ||
      this.storesLoading() ||
      this.storeError() ||
      this.submitted() ||
      this.tenantControl.value !== session.tenant.id ||
      !this.stores().some((store) => store.id === storeId)
    )
      return;
    this.submitted.set(true);
    this.tenantControl.disable({ emitEvent: false });
    this.storeControl.disable({ emitEvent: false });
    this.signedIn.emit({ session, storeId });
  }
}
