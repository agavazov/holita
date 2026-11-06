import {
  computed,
  DestroyRef,
  effect,
  Injectable,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import type {
  AdminAccountFragment,
  AdminDemoLoginMutation,
} from '../../../generated/graphql/operations';
import { AuthApi } from './auth-api';

// Retain the injection token so existing Fleet clients share the real session lifecycle.
export type AccountSession = AdminDemoLoginMutation['demoLogin'] & {
  readonly user?: AdminAccountFragment;
  readonly expiresAt?: string;
};
export type SessionNotice = 'expired' | 'passwordChanged' | 'signOutFailed';
const storageKey = 'holita.admin.session';
const legacyStorageKey = 'holita.admin.demo-session';

function restoredSession(): (AccountSession & { branchId: string | null }) | 'expired' | null {
  try {
    const stored =
      sessionStorage.getItem(storageKey) ??
      (isDevMode() ? sessionStorage.getItem(legacyStorageKey) : null);
    const value: unknown = JSON.parse(stored ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('token' in value) ||
      typeof value.token !== 'string' ||
      !('tenant' in value) ||
      !value.tenant ||
      typeof value.tenant !== 'object' ||
      !('id' in value.tenant) ||
      typeof value.tenant.id !== 'string' ||
      !('name' in value.tenant) ||
      typeof value.tenant.name !== 'string'
    ) {
      return null;
    }
    const expiresAt =
      'expiresAt' in value && typeof value.expiresAt === 'string' ? value.expiresAt : undefined;
    const demoExpiry =
      isDevMode() && value.token.startsWith('holita-demo.')
        ? Number(value.token.split('.')[2]) * 1000
        : NaN;
    const expiry = expiresAt ? Date.parse(expiresAt) : demoExpiry;
    if (!Number.isFinite(expiry)) {
      return null;
    }
    if (expiry <= Date.now()) {
      return 'expired';
    }
    // Stored identity is display data only; me and every backend request verify the bearer.
    return {
      token: value.token,
      tenant: { id: value.tenant.id, name: value.tenant.name },
      ...(expiresAt ? { expiresAt } : {}),
      branchId: 'branchId' in value && typeof value.branchId === 'string' ? value.branchId : null,
    };
  } catch {
    return null;
  }
}

export function isUnauthenticated(error: unknown): boolean {
  return (
    (CombinedGraphQLErrors.is(error) &&
      error.errors.some((failure) => failure.extensions?.['code'] === 'UNAUTHENTICATED')) ||
    (ServerError.is(error) && error.statusCode === 401)
  );
}

@Injectable({ providedIn: 'root' })
export class DemoSession {
  private readonly restored = restoredSession();
  private readonly state = signal<AccountSession | null>(
    typeof this.restored === 'object' ? this.restored : null,
  );
  readonly current = this.state.asReadonly();
  readonly user = computed(() => this.current()?.user ?? null);
  private readonly token = computed(() => this.current()?.token ?? null);
  private readonly selectedBranch = signal<string | null>(
    typeof this.restored === 'object' ? (this.restored?.branchId ?? null) : null,
  );
  readonly branchId = this.selectedBranch.asReadonly();
  readonly notice = signal<SessionNotice | null>(this.restored === 'expired' ? 'expired' : null);
  readonly signingOut = signal(false);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private failedSignOut: Readonly<{ tenantId: string; token: string }> | null = null;

  constructor() {
    this.scheduleExpiry();
    effect((onCleanup) => {
      const token = this.token();
      if (!token || !token.startsWith('holita-session.')) {
        return;
      }
      const { query, close } = this.api.watch(untracked(() => this.capture()));
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error && isUnauthenticated(result.error)) {
            this.expire(token);
          } else if (result.dataState === 'complete' && this.token() === token) {
            this.updateUser(result.data.me);
          }
        },
        error: (error: unknown) => {
          if (isUnauthenticated(error)) {
            this.expire(token);
          }
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        close();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.expiryTimer);
    });
  }

  start(session: AccountSession, branchId: string | null = null): void {
    this.notice.set(null);
    this.selectedBranch.set(branchId);
    this.state.set(session);
    this.persist();
    this.scheduleExpiry();
  }

  updateUser(user: AdminAccountFragment): void {
    const current = this.current();
    if (current && current.tenant.id === user.tenant.id) {
      this.state.set({ ...current, user });
    }
  }

  selectBranch(branchId: string): void {
    if (this.current()) {
      this.selectedBranch.set(branchId);
      this.persist();
    }
  }

  private persist(): void {
    const current = this.current();
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          token: current?.token,
          tenant: current?.tenant,
          expiresAt: current?.expiresAt,
          branchId: this.branchId(),
        }),
      );
    } catch {
      /* Memory session still works. */
    }
  }

  logout(): void {
    const current = this.current();
    if (!current || this.signingOut()) {
      return;
    }
    const scope = this.capture();
    this.clear();
    this.notice.set(null);
    if (current.token.startsWith('holita-session.')) {
      void this.revoke(scope);
    }
  }

  retrySignOut(): void {
    if (this.failedSignOut && !this.signingOut()) {
      void this.revoke(this.failedSignOut);
    }
  }

  private async revoke(scope: Readonly<{ tenantId: string; token: string }>): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.api.signOut(scope);
      this.failedSignOut = null;
      if (!this.current()) {
        this.notice.set(null);
      }
    } catch (error: unknown) {
      if (!isUnauthenticated(error)) {
        this.failedSignOut = scope;
        if (!this.current()) {
          this.notice.set('signOutFailed');
        }
      }
    } finally {
      this.signingOut.set(false);
    }
  }

  expire(capturedToken = this.current()?.token): void {
    if (capturedToken && this.current()?.token === capturedToken) {
      this.end('expired');
    }
  }

  end(reason: 'expired' | 'passwordChanged'): void {
    this.clear();
    this.notice.set(reason);
    const language = this.router.url.split('/')[1] === 'en' ? 'en' : 'bg';
    void this.router.navigate(['/', language, 'sign-in'], { replaceUrl: true });
  }

  private clear(): void {
    this.state.set(null);
    this.selectedBranch.set(null);
    clearTimeout(this.expiryTimer);
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(legacyStorageKey);
    } catch {
      /* The current client is still retired. */
    }
  }

  capture(): Readonly<{ tenantId: string; token: string }> {
    const session = this.current();
    if (!session) {
      throw new Error('Sign in to an organization first.');
    }
    return { tenantId: session.tenant.id, token: session.token };
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const current = this.current();
    const expires = current?.expiresAt
      ? Date.parse(current.expiresAt)
      : isDevMode() && current
        ? Number(current.token.split('.')[2]) * 1000
        : NaN;
    if (Number.isFinite(expires)) {
      this.expiryTimer = setTimeout(
        () => {
          this.expire(current?.token);
        },
        Math.min(28800_000, Math.max(0, expires - Date.now())),
      );
    }
  }
}
