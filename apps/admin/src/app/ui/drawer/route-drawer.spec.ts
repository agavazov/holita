import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UI_LANGUAGE } from '../ui-language';
import { leaveDrawer } from './leave-drawer.guard';
import { RouteDrawer, type RouteDrawerState } from './route-drawer';

const state = signal<RouteDrawerState>('ready');
const dirty = signal(false);
let retries = 0;

@Component({
  selector: 'holita-test-list',
  imports: [RouterOutlet, RouterLink],
  template: `
    <h1 id="page-title" tabindex="-1">Списък</h1>
    <a id="open" [routerLink]="['edit']" queryParamsHandling="preserve">Отвори</a>
    <router-outlet />
  `,
})
class TestList {}

@Component({
  selector: 'holita-test-editor',
  imports: [RouteDrawer],
  template: `
    <holita-route-drawer
      title="Редакция на CB 1001 AX"
      subtitle="Влекач"
      [state]="state()"
      errorText="Няма връзка"
      [dirty]="dirty()"
      (retry)="retry()"
    >
      <input id="plate" />
      <button drawerFooter type="button" class="save">Запази</button>
    </holita-route-drawer>
  `,
})
class TestEditor {
  readonly state = state;
  readonly dirty = dirty;
  readonly drawer = viewChild.required(RouteDrawer);
  canLeave(): boolean | Promise<boolean> {
    return this.drawer().confirmLeave(this.dirty());
  }
  retry(): void {
    retries++;
  }
}

async function open() {
  state.set('ready');
  dirty.set(false);
  retries = 0;
  TestBed.configureTestingModule({
    providers: [
      { provide: UI_LANGUAGE, useValue: signal('bg') },
      provideRouter([
        {
          path: 'list',
          component: TestList,
          children: [{ path: 'edit', component: TestEditor, canDeactivate: [leaveDrawer] }],
        },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create('/list?search=ca#rows');
  const trigger = document.getElementById('open');
  trigger?.focus();
  await harness.navigateByUrl('/list/edit?search=ca#rows');
  await harness.fixture.whenStable();
  return { harness, router: TestBed.inject(Router), trigger };
}

function drawer(): HTMLElement {
  const element = document.querySelector('.p-drawer.app-route-drawer');
  if (!(element instanceof HTMLElement)) throw new Error('Missing drawer.');
  return element;
}

function findButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent.trim() === label,
  );
}

function button(label: string): HTMLButtonElement {
  const match = findButton(label);
  if (!match) throw new Error(`Missing button ${label}.`);
  return match;
}

/**
 * A guarded navigation stays pending until the discard dialog is answered, so the fixture never
 * becomes stable meanwhile; this waits for the dialog's button instead.
 */
async function dialogButton(
  harness: RouterTestingHarness,
  label: string,
): Promise<HTMLButtonElement> {
  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    harness.fixture.detectChanges();
    const match = findButton(label);
    if (match) return match;
  }
  throw new Error(`Missing button ${label}.`);
}

async function dialogClosed(harness: RouterTestingHarness): Promise<void> {
  for (let attempt = 0; attempt < 50 && findButton('Продължи редакцията'); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    harness.fixture.detectChanges();
  }
  expect(findButton('Продължи редакцията')).toBeUndefined();
}

describe('RouteDrawer', () => {
  afterEach(() => {
    document.body.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((node) => {
      node.remove();
    });
  });

  it('keeps editor focus and restores the title when focus leaves the drawer', async () => {
    const { harness } = await open();
    const editor: unknown = harness.fixture.debugElement.query(
      (debug) => debug.componentInstance instanceof TestEditor,
    ).componentInstance;
    if (!(editor instanceof TestEditor)) throw new Error('Missing editor.');
    const input = document.getElementById('plate');
    input?.focus();
    editor.drawer().keepFocusInside();
    expect(document.activeElement).toBe(input);
    input?.blur();
    editor.drawer().keepFocusInside();
    expect(document.activeElement).toBe(drawer().querySelector('h2'));
  });

  it('opens as a labelled modal dialog and closes to its list with query and fragment', async () => {
    const { harness, router, trigger } = await open();
    const element = drawer();
    expect(element.getAttribute('role')).toBe('dialog');
    const title = document.getElementById(element.getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent.trim()).toBe('Редакция на CB 1001 AX');
    expect(element.textContent).toContain('Влекач');
    expect(element.querySelector('.route-drawer__footer .save')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('.route-drawer__close')?.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/list?search=ca#rows');
    expect(document.activeElement).toBe(trigger);
  });

  it('routes Escape to the close link', async () => {
    const { harness, router } = await open();
    document
      .getElementById('plate')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await harness.fixture.whenStable();
    expect(router.url).toBe('/list?search=ca#rows');
  });

  it('asks before discarding a dirty draft; keep editing cancels the navigation', async () => {
    const { harness, router } = await open();
    dirty.set(true);
    harness.fixture.detectChanges();
    const editor: unknown = harness.fixture.debugElement.query(
      (debug) => debug.componentInstance instanceof TestEditor,
    ).componentInstance;
    if (!(editor instanceof TestEditor)) throw new Error('Missing editor.');
    const first = editor.drawer().confirmLeave(true);
    const second = editor.drawer().confirmLeave(true);
    expect(second).toBe(first);
    harness.fixture.detectChanges();
    button('Продължи редакцията').click();
    await expect(first).resolves.toBe(false);
    await dialogClosed(harness);
    drawer().querySelector<HTMLButtonElement>('.route-drawer__close')?.click();
    (await dialogButton(harness, 'Продължи редакцията')).click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/list/edit?search=ca#rows');
    expect(document.querySelector('.p-drawer.app-route-drawer')).not.toBeNull();
    await dialogClosed(harness);
    drawer().querySelector<HTMLButtonElement>('.route-drawer__close')?.click();
    (await dialogButton(harness, 'Отхвърли промените')).click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/list?search=ca#rows');
  });

  it('shows not-found and error states with their actions', async () => {
    const { harness } = await open();
    state.set('not-found');
    harness.fixture.detectChanges();
    const notFound = drawer().querySelector('holita-empty-state');
    expect(notFound?.getAttribute('role')).toBe('alert');
    expect(notFound?.textContent).toContain('Записът не е намерен');
    expect(drawer().querySelector('.route-drawer__content')?.hasAttribute('hidden')).toBe(true);
    state.set('error');
    harness.fixture.detectChanges();
    expect(drawer().textContent).toContain('Няма връзка');
    button('Опитай отново').click();
    expect(retries).toBe(1);
    state.set('loading');
    harness.fixture.detectChanges();
    expect(drawer().querySelector('.route-drawer__skeleton')?.getAttribute('role')).toBe('status');
  });
});
