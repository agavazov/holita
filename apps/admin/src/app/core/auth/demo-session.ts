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
  UserRole,
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
const roleRank: Readonly<Record<UserRole, number>> = {
  VIEWER: 0,
  OPERATOR: 1,
  ENGINEER: 2,
  ADMINISTRATOR: 3,
};

type StoredSession = AccountSession & { branchId: string | null };

function readSession(stored: string | null, allowDemo: boolean): StoredSession | 'expired' | null {
  try {
    const value: unknown = JSON.parse(stored ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('token' in value) ||
      typeof value.token !== 'string' ||
      (!value.token.startsWith('holita-session.') &&
        !(allowDemo && value.token.startsWith('holita-demo.'))) ||
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
      allowDemo && value.token.startsWith('holita-demo.')
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

function restoredSession(): StoredSession | 'expired' | null {
  let tab: StoredSession | 'expired' | null = null;
  try {
    tab = readSession(
      sessionStorage.getItem(storageKey) ??
        (isDevMode() ? sessionStorage.getItem(legacyStorageKey) : null),
      isDevMode(),
    );
    if (tab && tab !== 'expired' && tab.token.startsWith('holita-demo.')) {
      return tab;
    }
  } catch {
    /* Shared storage or memory can still be available. */
  }
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const session = readSession(stored, false);
      if (session === 'expired') {
        localStorage.removeItem(storageKey);
      }
      return session;
    }
  } catch {
    /* Tab storage or memory can still be available. */
  }
  return tab;
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
  // A demo session has no user and acts as an Administrator, as the backend treats it.
  readonly role = computed<UserRole | null>(() => {
    const session = this.current();
    return session ? (session.user ? session.user.role : 'ADMINISTRATOR') : null;
  });
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
    if (this.restored === 'expired') {
      this.clear();
    } else if (this.current()?.token.startsWith('holita-session.')) {
      // Promote real sessions from the previous tab-only storage format.
      this.persist();
    }
    this.scheduleExpiry();
    const synchronize = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== storageKey && event.key !== null) ||
        this.current()?.token.startsWith('holita-demo.')
      ) {
        return;
      }
      const restored = readSession(event.newValue, false);
      if (restored && restored !== 'expired') {
        if (restored.token !== this.current()?.token) {
          this.notice.set(null);
          this.selectedBranch.set(restored.branchId);
          this.state.set(restored);
          this.scheduleExpiry();
        }
      } else if (this.current()?.token.startsWith('holita-session.')) {
        this.clear();
        this.notice.set(restored === 'expired' ? 'expired' : null);
        this.showSignIn();
      }
    };
    window.addEventListener('storage', synchronize);
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
      window.removeEventListener('storage', synchronize);
    });
  }

  hasRole(minimum: UserRole): boolean {
    const role = this.role();
    return role !== null && roleRank[role] >= roleRank[minimum];
  }

  start(session: AccountSession, branchId: string | null = null): void {
    this.notice.set(null);
    this.selectedBranch.set(branchId);
    this.state.set(session);
    this.persist();
    this.scheduleExpiry();
  }

  updateUser(user: Omit<AdminAccountFragment, 'role'> & { readonly role?: UserRole }): void {
    const current = this.current();
    const role = user.role ?? current?.user?.role;
    if (current && current.tenant.id === user.tenant.id && role !== undefined) {
      this.state.set({ ...current, user: { ...user, role } });
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
      const real = current?.token.startsWith('holita-session.');
      const storage = real ? localStorage : sessionStorage;
      storage.setItem(
        storageKey,
        JSON.stringify({
          token: current?.token,
          tenant: current?.tenant,
          expiresAt: current?.expiresAt,
          branchId: this.branchId(),
        }),
      );
      if (real) {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(legacyStorageKey);
      }
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
    this.showSignIn();
  }

  private showSignIn(): void {
    const language = this.router.url.split('/')[1] === 'en' ? 'en' : 'bg';
    void this.router.navigate(['/', language, 'sign-in'], { replaceUrl: true });
  }

  private clear(shared = this.current()?.token.startsWith('holita-session.') ?? false): void {
    this.state.set(null);
    this.selectedBranch.set(null);
    clearTimeout(this.expiryTimer);
    if (shared) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* The current client is still retired. */
      }
    }
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
