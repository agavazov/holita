import { TestBed } from '@angular/core/testing';
import { DemoSession } from './demo-session';

const tenant = { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' };
const storageKey = 'holita.admin.demo-session';
describe('Tab-local demo session', () => {
  beforeEach(() => {
    sessionStorage.removeItem(storageKey);
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    sessionStorage.removeItem(storageKey);
    vi.useRealTimers();
  });
  it('restores a current tab session, expires it and removes storage on logout', async () => {
    vi.useFakeTimers();
    const expiry = Math.floor(Date.now() / 1000) + 30;
    const token = `holita-demo.${tenant.id}.${String(expiry)}.${'s'.repeat(43)}`;
    sessionStorage.setItem(storageKey, JSON.stringify({ tenant, token, branchId: 'branch-a' }));
    const session = TestBed.inject(DemoSession);
    expect(session.branchId()).toBe('branch-a');
    session.selectBranch('branch-b');
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? '{}')).toMatchObject({
      branchId: 'branch-b',
    });
    expect(session.capture()).toEqual({ tenantId: tenant.id, token });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(session.current()).toBeNull();
    expect(session.branchId()).toBeNull();
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(() => session.capture()).toThrow('Sign in');
  });
  it.each([
    'broken JSON',
    JSON.stringify({ token: 'invalid', tenant }),
    JSON.stringify({ token: `holita-demo.${tenant.id}.1000000000.${'s'.repeat(43)}`, tenant }),
  ])('ignores malformed or expired stored sessions', (value) => {
    sessionStorage.setItem(storageKey, value);
    expect(TestBed.inject(DemoSession).current()).toBeNull();
  });
  it('requires a new sign-in for a session with the former Store scope', () => {
    const expiry = Math.floor(Date.now() / 1000) + 30;
    const token = `holita-demo.${tenant.id}.${String(expiry)}.${'s'.repeat(43)}`;
    sessionStorage.setItem(storageKey, JSON.stringify({ tenant, token, storeId: 'old-scope' }));
    const session = TestBed.inject(DemoSession);
    expect(session.current()).toBeNull();
    expect(session.branchId()).toBeNull();
  });
});
