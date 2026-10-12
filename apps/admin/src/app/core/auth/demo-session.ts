import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { AdminDemoLoginMutation } from '../../../generated/graphql/operations';

type Session = AdminDemoLoginMutation['demoLogin'];
const storageKey = 'holita.admin.demo-session';

function restoredSession(): (Session & { storeId: string | null }) | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
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
    )
      return null;
    const match = /^holita-demo\.([0-9a-f-]{36})\.([0-9]{10})\.[A-Za-z0-9_-]{43}$/.exec(
      value.token,
    );
    if (!match || match[1] !== value.tenant.id || Number(match[2]) <= Date.now() / 1000)
      return null;
    // The backend verifies the signature on every request; storage is never an authority.
    return {
      token: value.token,
      tenant: { id: value.tenant.id, name: value.tenant.name },
      storeId: 'storeId' in value && typeof value.storeId === 'string' ? value.storeId : null,
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class DemoSession {
  private readonly restored = restoredSession();
  private readonly state = signal<Session | null>(this.restored);
  readonly current = this.state.asReadonly();
  private readonly selectedStore = signal<string | null>(this.restored?.storeId ?? null);
  readonly storeId = this.selectedStore.asReadonly();
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    this.scheduleExpiry();
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.expiryTimer);
    });
  }
  start(session: Session, storeId: string | null = null): void {
    this.selectedStore.set(storeId);
    this.state.set(session);
    this.persist();
    this.scheduleExpiry();
  }
  selectStore(storeId: string): void {
    if (!this.current()) return;
    this.selectedStore.set(storeId);
    this.persist();
  }
  private persist(): void {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ...this.current(), storeId: this.storeId() }),
      );
    } catch {
      /* Memory session still works. */
    }
  }
  logout(): void {
    this.state.set(null);
    this.selectedStore.set(null);
    clearTimeout(this.expiryTimer);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* The current client is still retired. */
    }
  }
  capture(): Readonly<{ tenantId: string; token: string }> {
    const session = this.current();
    if (!session) throw new Error('Sign in to a tenant first.');
    return { tenantId: session.tenant.id, token: session.token };
  }
  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const expiry = this.current()?.token.split('.')[2];
    if (expiry && /^[0-9]{10}$/.test(expiry))
      this.expiryTimer = setTimeout(
        () => {
          this.logout();
        },
        Math.min(28800_000, Math.max(0, Number(expiry) * 1000 - Date.now())),
      );
  }
}
