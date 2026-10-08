import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import {
  RelationPicker,
  type RelationLoader,
  type RelationPage,
  type RelationRequest,
} from './relation-picker';
const one = '30000000-0000-4000-8000-000000000001';
const two = '30000000-0000-4000-8000-000000000002';
const old = '30000000-0000-4000-8000-000000000003';
async function mount(load: RelationLoader, selectedIds: string[] = [], multiple = false) {
  const fixture = TestBed.createComponent(RelationPicker);
  fixture.componentRef.setInput('language', 'en');
  fixture.componentRef.setInput('label', 'Venue');
  fixture.componentRef.setInput('controlId', 'test-venue');
  fixture.componentRef.setInput('load', load);
  fixture.componentRef.setInput('selectedIds', selectedIds);
  fixture.componentRef.setInput('multiple', multiple);
  await fixture.whenStable();
  return fixture;
}
describe('Remote relation presentation', () => {
  it('cancels pending search when closing so reopening cannot reset the new page', async () => {
    const calls: RelationRequest[] = [];
    const fixture = await mount((request) => {
      calls.push(request);
      return of({ items: [], total: 41 });
    });
    vi.useFakeTimers();
    try {
      const picker = fixture.componentInstance;
      picker.show();
      picker.editSearch('Abandoned search');
      picker.close();
      picker.show();
      picker.changePage({ first: 20 });
      await vi.advanceTimersByTimeAsync(300);
      expect(calls.map((request) => request.offset)).toEqual([0, 0, 20]);
      expect(picker.offset()).toBe(20);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });
  it('hydrates inactive selected rows without allowing new inactive selection', async () => {
    const load: RelationLoader = (request) =>
      of({
        items: request.ids
          ? [{ id: old, name: 'Old venue', active: false }]
          : [
              { id: one, name: 'New venue', active: true },
              { id: two, name: 'Inactive venue', active: false },
            ],
        total: 2,
      });
    const fixture = await mount(load, [old]);
    const picker = fixture.componentInstance;
    expect(picker.selectedLabel()).toBe('Old venue (Inactive)');
    picker.show();
    await fixture.whenStable();
    expect(picker.options().find((row) => row.id === two)?.disabled).toBe(true);
    const emit = vi.spyOn(picker.selectedIdsChange, 'emit');
    picker.select(two);
    expect(emit).toHaveBeenLastCalledWith([]);
    picker.select(one);
    expect(emit).toHaveBeenLastCalledWith([one]);
    fixture.destroy();
  });
  it('retains choices on other pages, deduplicates IDs and clears explicitly', async () => {
    const fixture = await mount(
      () => of({ items: [{ id: two, name: 'Page two', active: true }], total: 21 }),
      [one],
      true,
    );
    const picker = fixture.componentInstance;
    const emit = vi.spyOn(picker.selectedIdsChange, 'emit');
    picker.show();
    picker.select([two]);
    expect(emit).toHaveBeenLastCalledWith([one, two]);
    picker.clear();
    expect(emit).toHaveBeenLastCalledWith([]);
    fixture.destroy();
  });
  it('cancels superseded pages, debounces remote search at 250ms and retires reads on closing', async () => {
    const calls: RelationRequest[] = [];
    const reads: Subject<RelationPage>[] = [];
    const fixture = await mount((request) => {
      calls.push(request);
      const read = new Subject<RelationPage>();
      reads.push(read);
      return read;
    });
    const picker = fixture.componentInstance;
    picker.show();
    picker.changePage({ first: 20 });
    reads[0]?.next({ items: [{ id: one, name: 'Stale', active: true }], total: 100 });
    expect(picker.page().items).toEqual([]);
    reads[1]?.next({ items: [{ id: two, name: 'Current', active: true }], total: 21 });
    expect(picker.page().items[0]?.name).toBe('Current');
    picker.editSearch('current');
    expect(calls).toHaveLength(2);
    await vi.waitFor(() => {
      expect(calls).toHaveLength(3);
    });
    expect(calls[2]).toMatchObject({ offset: 0, search: 'current', active: true });
    picker.close();
    reads[2]?.next({ items: [{ id: one, name: 'Late', active: true }], total: 1 });
    expect(picker.page().items).toEqual([]);
    fixture.destroy();
  });
  it('offers retry for failed hydration and search, and prevents actions when disabled', async () => {
    let fail = true;
    const fixture = await mount(
      () =>
        fail
          ? throwError(() => new Error('Read failed'))
          : of({ items: [{ id: one, name: 'Recovered', active: true }], total: 1 }),
      [one],
    );
    const picker = fixture.componentInstance;
    expect(picker.failure()).toBe('Could not reach the gateway.');
    fail = false;
    picker.retry();
    expect(picker.selectedLabel()).toBe('Recovered');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    picker.show();
    expect(picker.open()).toBe(false);
    const emit = vi.spyOn(picker.selectedIdsChange, 'emit');
    picker.select(two);
    picker.clear();
    expect(emit).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('bounds remote search by Unicode code points and strips NUL before sending it', async () => {
    const calls: RelationRequest[] = [];
    const fixture = await mount((request) => {
      calls.push(request);
      return of({ items: [], total: 0 });
    });
    const picker = fixture.componentInstance;
    picker.show();
    picker.editSearch('  \0' + '😀'.repeat(201) + '  ');
    await vi.waitFor(() => {
      expect(calls).toHaveLength(2);
    });
    expect(calls[1]?.search).toBe('😀'.repeat(200));
    expect(picker.search()).toBe('😀'.repeat(200));
    fixture.destroy();
  });
  it('retries selected labels without starting a hidden choices request', async () => {
    const calls: RelationRequest[] = [];
    let fail = true;
    const fixture = await mount(
      (request) => {
        calls.push(request);
        return fail
          ? throwError(() => new Error('Selected lookup failed'))
          : of({ items: [{ id: one, name: 'Recovered', active: true }], total: 1 });
      },
      [one],
    );
    fail = false;
    fixture.componentInstance.retry();
    expect(calls).toEqual([
      { ids: [one], offset: 0 },
      { ids: [one], offset: 0 },
    ]);
    expect(fixture.componentInstance.selectedLabel()).toBe('Recovered');
    expect(fixture.componentInstance.open()).toBe(false);
    fixture.destroy();
  });
});
