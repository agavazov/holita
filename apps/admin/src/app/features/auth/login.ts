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
  AdminBranchesQuery,
  AdminTenantsQuery,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, type Language } from '../../i18n/messages';
import { Appearance } from '../../theme/appearance';
import { BranchesApi } from '../branches/branches-api';

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
  readonly signedIn = output<{ session: Session; branchId: string }>();
  readonly text = computed(() => messages[this.language()]);
  readonly appearance = inject(Appearance);
  readonly tenantControl = new FormControl<string | null>(null);
  readonly branchControl = new FormControl<string | null>({ value: null, disabled: true });
  readonly form = new FormGroup({ tenant: this.tenantControl, branch: this.branchControl });
  readonly tenants = signal<AdminTenantsQuery['tenants']>([]);
  readonly branches = signal<AdminBranchesQuery['branches']>([]);
  readonly tenantsLoading = signal(true);
  readonly branchesLoading = signal(false);
  readonly tenantError = signal<unknown>(null);
  readonly branchError = signal<unknown>(null);
  readonly failure = computed(() =>
    requestError(this.tenantError() ?? this.branchError(), this.text().networkError),
  );
  readonly submitted = signal(false);
  private readonly api = inject(BranchesApi);
  private revision = 0;
  private preparedSession: Session | null = null;
  private closeBranches: (() => void) | undefined;
  private closeTenants: (() => void) | undefined;

  constructor() {
    this.tenantControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      void this.loadBranches(id, this.language());
    });
    effect((onCleanup) => {
      const language = this.language();
      this.loadTenants(language);
      void this.loadBranches(this.tenantControl.value, language);
      onCleanup(() => {
        this.revision++;
        this.closeTenants?.();
        this.closeBranches?.();
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

  private async loadBranches(tenantId: string | null, language: Language): Promise<void> {
    const revision = ++this.revision;
    this.closeBranches?.();
    this.closeBranches = undefined;
    this.preparedSession = null;
    this.branchControl.reset({ value: null, disabled: true });
    this.branches.set([]);
    this.branchError.set(null);
    this.branchesLoading.set(!!tenantId);
    if (!tenantId) return;
    try {
      // A candidate token can only discover its tenant's branches; it is not an active UI session.
      const session = await this.api.login(tenantId, language);
      if (revision !== this.revision) return;
      const { query, close } = this.api.watch(language, {
        tenantId: session.tenant.id,
        token: session.token,
      });
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.branchesLoading.set(result.loading);
          this.branchError.set(result.error ?? null);
          if (result.dataState === 'complete') {
            this.branches.set(result.data.branches);
            this.preparedSession = session;
            if (result.data.branches.length) this.branchControl.enable();
          }
        },
        error: (error: unknown) => {
          this.branchesLoading.set(false);
          this.branchError.set(error);
        },
      });
      this.closeBranches = () => {
        subscription.unsubscribe();
        close();
      };
    } catch (error) {
      if (revision === this.revision) {
        this.branchesLoading.set(false);
        this.branchError.set(error);
      }
    }
  }

  retry(): void {
    if (this.tenantError()) this.loadTenants(this.language());
    else void this.loadBranches(this.tenantControl.value, this.language());
  }

  login(): void {
    const session = this.preparedSession;
    const branchId = this.branchControl.value;
    if (
      !session ||
      !branchId ||
      this.branchesLoading() ||
      this.branchError() ||
      this.submitted() ||
      this.tenantControl.value !== session.tenant.id ||
      !this.branches().some((branch) => branch.id === branchId)
    )
      return;
    this.submitted.set(true);
    this.tenantControl.disable({ emitEvent: false });
    this.branchControl.disable({ emitEvent: false });
    this.signedIn.emit({ session, branchId });
  }
}
