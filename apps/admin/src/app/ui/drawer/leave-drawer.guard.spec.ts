import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { leaveDrawer, type LeavableDrawer } from './leave-drawer.guard';

function run(component: LeavableDrawer | null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const state = TestBed.inject(Router).routerState.snapshot;
  return TestBed.runInInjectionContext(() => leaveDrawer(component, state.root, state, state));
}

describe('leaveDrawer', () => {
  it('lets routes without a mounted drawer leave', () => {
    expect(run(null)).toBe(true);
  });

  it('asks a mounted drawer', () => {
    expect(run({ canLeave: () => false })).toBe(false);
  });

  it('waits for an asynchronous answer', async () => {
    await expect(run({ canLeave: () => Promise.resolve(true) })).resolves.toBe(true);
  });
});
