import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { RowActions, type RowAction } from './row-actions';

@Component({
  imports: [RowActions],
  template: `<holita-row-actions
    [actions]="actions"
    subject="CB 1001 AX"
    (action)="chosen.push($event)"
  />`,
})
class Host {
  readonly actions: readonly RowAction[] = [
    { id: 'delete', label: 'Delete', danger: true },
    { id: 'edit', label: 'Edit' },
    { id: 'archive', label: 'Archive', disabled: true },
  ];
  readonly chosen: string[] = [];
}

describe('RowActions', () => {
  afterEach(() => {
    document.body.querySelectorAll('.p-menu').forEach((node) => {
      node.remove();
    });
  });

  it('names the trigger, lists destructive actions last and emits the chosen action', async () => {
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
    expect(items[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(items[2]?.closest('.app-menu-danger')).not.toBeNull();

    const link = items[0]?.querySelector('a, .p-menu-item-link');
    if (!(link instanceof HTMLElement)) throw new Error('Missing menu link.');
    link.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.chosen).toEqual(['edit']);
  });
});
