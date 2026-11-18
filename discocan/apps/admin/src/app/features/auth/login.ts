import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  isDevMode,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, type UrlTree } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type { AdminBranchesQuery, AdminTenantsQuery } from '../../../generated/graphql/operations';
import { AuthApi } from '../../core/auth/auth-api';
import { DemoSession, isUnauthenticated, type AccountSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { ThemeMenu } from '../../ui/theme-menu/theme-menu';
import { Appearance } from '../../theme/appearance';
import { FormField } from '../../ui/form-field/form-field';
import { BranchesApi } from '../branches/branches-api';
import bg from './login.bg.json';
import en from './login.en.json';

@Component({
  selector: 'discocan-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Select,
    ButtonDirective,
    InputText,
    Message,
    ThemeMenu,
    FormField,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  readonly language = input.required<Language>();
  readonly languageUrl = input.required<UrlTree>();
  readonly signedIn = output<{ session: AccountSession; branchId: string }>();
  readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  readonly appearance = inject(Appearance);
  readonly session = inject(DemoSession);
  readonly demoAvailable = isDevMode();
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        (control) => Validators.email(control),
        Validators.maxLength(254),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control)],
    }),
  });
  readonly tenantControl = new FormControl<string | null>(null);
  readonly branchControl = new FormControl<string | null>(null, (control) =>
    Validators.required(control),
  );
  readonly tenants = signal<AdminTenantsQuery['tenants']>([]);
  readonly branches = signal<AdminBranchesQuery['branches']>([]);
  private readonly sessionToken = computed(() => this.session.current()?.token ?? null);
  readonly prepared = linkedSignal({
    source: this.sessionToken,
    computation: () => this.session.current(),
  });
  readonly busy = signal(false);
  readonly branchesLoading = signal(false);
  readonly tenantsLoading = signal(false);
  readonly failure = signal<'credentials' | 'network' | 'branches' | 'tenants' | null>(null);
  readonly submitted = signal(false);
  readonly demoOpen = signal(false);
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly api = inject(BranchesApi);
  private closeBranches: (() => void) | undefined;
  private closeTenants: (() => void) | undefined;
  private revision = 0;
  private destroyed = false;

  constructor() {
    effect(() => {
      const token = this.sessionToken();
      untracked(() => {
        const current = this.session.current();
        if (token?.startsWith('discocan-session.') && current) {
          this.loadBranches(current, this.language());
        } else if (!token) {
          this.closeBranches?.();
          this.closeBranches = undefined;
          this.branches.set([]);
          this.branchesLoading.set(false);
          this.failure.set(null);
          this.form.enable();
        }
      });
    });
    let previousLanguage: Language | undefined;
    effect(() => {
      const language = this.language();
      untracked(() => {
        if (previousLanguage && previousLanguage !== language) {
          this.revision++;
          this.busy.set(false);
          this.failure.set(null);
          const session = this.prepared();
          if (session) {
            this.loadBranches(session, language);
          } else {
            this.form.enable();
          }
          if (this.demoOpen()) {
            this.openDemo();
          }
        }
      });
      previousLanguage = language;
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.revision++;
      this.closeBranches?.();
      this.closeTenants?.();
    });
  }

  fieldError(field: 'email' | 'password'): string | null {
    const control = this.form.controls[field];
    return control.touched && control.invalid
      ? this.text()[field === 'email' ? 'emailError' : 'passwordError']
      : null;
  }

  async login(): Promise<void> {
    if (this.busy() || this.session.signingOut()) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      document
        .getElementById(this.form.controls.email.invalid ? 'login-email' : 'login-password')
        ?.focus();
      return;
    }
    const revision = ++this.revision;
    const language = this.language();
    this.busy.set(true);
    this.failure.set(null);
    this.form.disable();
    try {
      const value = this.form.getRawValue();
      const session = await this.auth.signIn(value.email, value.password, language);
      if (this.destroyed || revision !== this.revision) {
        void this.auth
          .signOut({ tenantId: session.tenant.id, token: session.token })
          .catch(() => undefined);
        return;
      }
      this.form.controls.password.reset();
      this.session.start(session);
    } catch (error: unknown) {
      if (!this.destroyed && revision === this.revision) {
        this.failure.set(isUnauthenticated(error) ? 'credentials' : 'network');
        this.form.enable();
        document.getElementById('login-password')?.focus();
      }
    } finally {
      if (!this.destroyed && revision === this.revision) {
        this.busy.set(false);
      }
    }
  }

  private loadBranches(session: AccountSession, language: Language): void {
    this.closeBranches?.();
    this.branchesLoading.set(true);
    this.failure.set(null);
    this.branchControl.reset();
    const { query, close } = this.api.watch(language, {
      tenantId: session.tenant.id,
      token: session.token,
    });
    const subscription = query.valueChanges.subscribe({
      next: (result) => {
        this.branchesLoading.set(result.loading);
        if (result.error) {
          this.failure.set('branches');
        }
        if (result.dataState === 'complete') {
          this.branches.set(result.data.branches);
          if (result.data.branches.length === 1) {
            this.branchControl.setValue(result.data.branches[0]?.id ?? null);
            this.enter();
          }
        }
      },
      error: (error: unknown) => {
        this.branchesLoading.set(false);
        if (isUnauthenticated(error)) {
          this.back();
          this.failure.set('credentials');
        } else {
          this.failure.set('branches');
        }
      },
    });
    this.closeBranches = () => {
      subscription.unsubscribe();
      close();
    };
  }

  enter(): void {
    const session = this.prepared();
    const branchId = this.branchControl.value;
    if (
      !session ||
      !branchId ||
      this.submitted() ||
      this.branchesLoading() ||
      this.failure() ||
      !this.branches().some((branch) => branch.id === branchId)
    ) {
      return;
    }
    this.submitted.set(true);
    this.signedIn.emit({ session, branchId });
  }

  async openProfile(): Promise<void> {
    const session = this.prepared();
    if (!session || this.submitted() || this.branchesLoading()) {
      return;
    }
    this.submitted.set(true);
    if (await this.router.navigate(['/', this.language(), 'profile'])) {
      this.session.start(session);
    } else {
      this.submitted.set(false);
    }
  }

  back(): void {
    this.closeBranches?.();
    this.closeBranches = undefined;
    const session = this.prepared();
    this.prepared.set(null);
    this.branches.set([]);
    this.branchesLoading.set(false);
    this.failure.set(null);
    this.form.enable();
    if (session?.token.startsWith('discocan-session.')) {
      this.session.logout();
    }
  }

  retry(): void {
    const session = this.prepared();
    if (session) {
      this.loadBranches(session, this.language());
    } else if (this.failure() === 'tenants') {
      this.openDemo();
    } else {
      void this.login();
    }
  }

  openDemo(): void {
    if (!this.demoAvailable) {
      return;
    }
    this.demoOpen.set(true);
    this.tenantsLoading.set(true);
    this.failure.set(null);
    this.closeTenants?.();
    const subscription = this.api.tenants(this.language()).valueChanges.subscribe({
      next: (result) => {
        this.tenantsLoading.set(result.loading);
        if (result.error) {
          this.failure.set('tenants');
        }
        if (result.dataState === 'complete') {
          this.tenants.set(result.data.tenants);
        }
      },
      error: () => {
        this.tenantsLoading.set(false);
        this.failure.set('tenants');
      },
    });
    this.closeTenants = () => {
      subscription.unsubscribe();
    };
  }

  async demoLogin(): Promise<void> {
    const tenantId = this.tenantControl.value;
    if (!this.demoAvailable || !tenantId || this.busy()) {
      return;
    }
    const revision = ++this.revision;
    this.busy.set(true);
    this.failure.set(null);
    try {
      const session = await this.api.login(tenantId, this.language());
      if (!this.destroyed && revision === this.revision) {
        this.prepared.set(session);
        this.loadBranches(session, this.language());
      }
    } catch {
      if (!this.destroyed && revision === this.revision) {
        this.failure.set('network');
      }
    } finally {
      if (!this.destroyed && revision === this.revision) {
        this.busy.set(false);
      }
    }
  }
}
