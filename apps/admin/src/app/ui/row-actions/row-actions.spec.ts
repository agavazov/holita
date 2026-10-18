import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ListActionBase, ListRecord } from '../list/list-actions';
import { UI_LANGUAGE } from '../ui-language';
import { type RowChoice, RowActions } from './row-actions';

type Action = 'edit' | 'archive' | 'delete';

@Component({
  imports: [RowActions],
  template: `<holita-row-actions
    [actions]="actions"
    [record]="record"
    (choose)="chosen.push($event)"
  />`,
})
class Host {
  readonly actions: readonly ListActionBase<Action>[] = [
    { id: 'delete', label: 'Delete', danger: true, bulk: true },
    { id: 'edit', label: 'Edit' },
    { id: 'archive', label: 'Archive', bulk: true },
  ];
  readonly record: ListRecord<Action> = {
    id: 'v1',
    label: 'CB 1001 AX',
    unavailable: ['archive'],
  };
  readonly chosen: RowChoice<Action>[] = [];
}

describe('RowActions', () => {
  afterEach(() => {
    document.body.querySelectorAll('.p-menu').forEach((node) => {
      node.remove();
    });
  });

  it('names the trigger, lists every action with destructive ones last and emits the choice', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal<'en' | 'bg'>('en').asReadonly() }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) throw new Error('Missing host.');
    const trigger = root.querySelector('button');
    if (!(trigger instanceof HTMLButtonElement)) throw new Error('Missing trigger.');
    expect(trigger.getAttribute('aria-label')).toBe('Actions for CB 1001 AX');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    await fixture.whenStable();
    const items = [...document.body.querySelectorAll('.p-menu [role="menuitem"]')];
    expect(items.map((item) => item.textContent.trim())).toEqual(['Edit', 'Archive', 'Delete']);
    expect(document.body.querySelectorAll('.p-menu [role="separator"]')).toHaveLength(1);
    // Archive does not apply to this record.
    expect(items[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(items[2]?.closest('.app-menu-danger')).not.toBeNull();

    const link = items[0]?.querySelector('.p-menu-item-link');
    if (!(link instanceof HTMLElement)) throw new Error('Missing menu link.');
    link.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.chosen).toEqual([{ action: 'edit', origin: trigger }]);
  });
});
