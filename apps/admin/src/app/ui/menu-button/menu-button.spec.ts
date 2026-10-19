import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { type MenuChoice, MenuButton, type MenuOption } from './menu-button';

@Component({
  imports: [MenuButton],
  template: `<holita-menu-button
    variant="text"
    [header]="{ title: 'Demo Logistics Ltd', detail: 'Sofia Fleet' }"
    [options]="options()"
    [disabled]="disabled()"
    (choose)="chosen.push($event)"
    (opened)="openings = openings + 1"
    ><span class="app-visually-hidden">Branch: </span><span>Sofia Fleet</span></holita-menu-button
  >`,
})
class Host {
  readonly options = signal<readonly MenuOption[]>([
    { id: 'sofia', label: 'Sofia Fleet', selected: true },
    { id: 'plovdiv', label: 'Plovdiv Fleet' },
    { id: 'bg', label: 'Български', lang: 'bg' },
  ]);
  readonly disabled = signal(false);
  readonly chosen: MenuChoice[] = [];
  openings = 0;
}

async function render(
  configure: (host: Host) => void = () => undefined,
): Promise<{ readonly fixture: ComponentFixture<Host>; readonly trigger: HTMLButtonElement }> {
  TestBed.configureTestingModule({
    providers: [{ provide: UI_LANGUAGE, useValue: signal<'en' | 'bg'>('en').asReadonly() }],
  });
  const fixture = TestBed.createComponent(Host);
  configure(fixture.componentInstance);
  await fixture.whenStable();
  const root: unknown = fixture.nativeElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error('Missing host.');
  }
  const trigger = root.querySelector('button');
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error('Missing trigger.');
  }
  return { fixture, trigger };
}

function menuItems(): Element[] {
  return [...document.body.querySelectorAll('.p-menu [role="menuitem"]')];
}

function text(element: Element | undefined): string | undefined {
  return element?.textContent.replace(/\s+/g, ' ').trim();
}

describe('MenuButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.querySelectorAll('.p-menu').forEach((node) => {
      node.remove();
    });
  });

  it('names itself from its content, marks the current choice and refocuses after a choice', async () => {
    const { fixture, trigger } = await render();
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(text(trigger)).toBe('Branch: Sofia Fleet');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = document.body.querySelector('.p-menu');
    const title = menu?.querySelector('.menu-button__title');
    expect(title?.textContent).toBe('Demo Logistics Ltd');
    expect(menu?.querySelector('[role="menu"]')?.getAttribute('aria-labelledby')).toBe(title?.id);
    const items = menuItems();
    expect(items.map((item) => item.hasAttribute('aria-label'))).toEqual([false, false, false]);
    expect(text(items[0])).toBe('Sofia Fleet, current choice');
    expect(items[0]?.querySelector('.menu-button__check')).not.toBeNull();
    expect(items[1]?.querySelector('.menu-button__check')).toBeNull();
    expect(items[2]?.querySelector('[lang="bg"]')?.textContent).toBe('Български');
    // p-menu generates unique item IDs instead of the option IDs.
    expect(items.some((item) => item.id === 'plovdiv')).toBe(false);

    const link = items[1]?.querySelector('.p-menu-item-link');
    if (!(link instanceof HTMLElement)) {
      throw new Error('Missing option.');
    }
    link.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.chosen.map((choice) => choice.id)).toEqual(['plovdiv']);
    expect(fixture.componentInstance.chosen[0]?.origin).toBe(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with keyboard focus on the current choice past disabled, danger and separated options', async () => {
    const { fixture, trigger } = await render((host) => {
      host.options.set([
        { id: 'a', label: 'A' },
        { id: 'x', label: 'X', disabled: true },
        { id: 'del', label: 'Delete', danger: true },
        { id: 'b', label: 'B', separated: true, selected: true },
      ]);
    });

    trigger.click();
    await fixture.whenStable();
    expect(menuItems().map(text)).toEqual(['A', 'X', 'B, current choice', 'Delete']);
    const focused = menuItems().filter((item) => item.getAttribute('data-focused') === 'true');
    expect(focused.map(text)).toEqual(['B, current choice']);
    expect(
      document.body.querySelector('.p-menu [role="menu"]')?.getAttribute('aria-activedescendant'),
    ).toBe(focused[0]?.id);
  });

  it('scrolls the focused option into view', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { fixture, trigger } = await render((host) => {
      host.options.set([
        { id: 'sofia', label: 'Sofia Fleet' },
        { id: 'plovdiv', label: 'Plovdiv Fleet' },
        { id: 'varna', label: 'Varna Fleet', selected: true },
      ]);
    });

    trigger.click();
    await fixture.whenStable();
    expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(scroll.mock.contexts.at(-1)).toBe(menuItems().at(-1));
  });

  it('closes on Escape with the focus on the trigger and reports itself collapsed', async () => {
    const { fixture, trigger } = await render();
    trigger.click();
    await fixture.whenStable();
    const list = document.body.querySelector('.p-menu [role="menu"]');
    if (!list) {
      throw new Error('Missing menu.');
    }

    list.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays focusable but does not open while disabled', async () => {
    const { fixture, trigger } = await render((host) => {
      host.disabled.set(true);
    });

    trigger.click();
    await fixture.whenStable();
    expect(menuItems()).toEqual([]);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it('reports each opening once', async () => {
    const { fixture, trigger } = await render();
    trigger.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.openings).toBe(1);
  });
});
