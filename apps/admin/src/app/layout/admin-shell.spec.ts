import { Component, reflectComponentType, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterOutlet, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Appearance } from '../theme/appearance';
import { WALL_CLOCK } from '../ui/clock';
import { AdminShell } from './admin-shell';
import type { ShellNotification } from './admin-topbar';
import type { NavGroup, PageContext } from './navigation';

const branches = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Discordia' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Sandbox' },
];
const start = Date.parse('2026-10-18T07:00:00.000Z');
/** The wall clock of the shell; tests move it forward. */
let now = start;
const navigation: readonly NavGroup[] = [
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { id: 'a', label: 'Page A', icon: 'truck', link: ['/', 'a'] },
      { id: 'b', label: 'Page B', icon: 'mobile', link: ['/', 'b'] },
    ],
  },
];

@Component({ selector: 'holita-test-page-a', template: '<h1 id="page-title" tabindex="-1">A</h1>' })
class PageA {}

@Component({ selector: 'holita-test-page-b', template: '<h1 id="page-title" tabindex="-1">B</h1>' })
class PageB {}

@Component({
  imports: [AdminShell, RouterOutlet],
  template: `
    <holita-admin-shell
      [branches]="branches()"
      [branchId]="branchId()"
      language="en"
      [languages]="languages"
      (languageChange)="events.push('language ' + $event)"
      [navigation]="navigation"
      [context]="context()"
      tenantName="RentalSofia"
      [notifications]="notifications()"
      (notificationOpen)="events.push('open ' + $event)"
      (notificationsRead)="events.push('read')"
      (signOut)="events.push('sign out')"
      (branchSelected)="selected.push($event)"
    >
      <router-outlet />
    </holita-admin-shell>
  `,
})
class ShellHost {
  readonly branches = signal<readonly { id: string; name: string }[]>(branches);
  readonly navigation = navigation;
  readonly branchId = signal<string | null>(branches[0]?.id ?? null);
  readonly context = signal<PageContext>({ group: 'Fleet', page: 'Page A' });
  readonly languages = [
    { code: 'bg', label: 'Български' },
    { code: 'en', label: 'English' },
  ];
  readonly notifications = signal<readonly ShellNotification[]>([
    { id: 'n1', title: 'Engine alert', at: new Date(start - 30_000).toISOString(), unread: true },
  ]);
  readonly selected: string[] = [];
  /** The topbar menus' outputs, in order. */
  readonly events: string[] = [];
}

function resize(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

async function mount() {
  TestBed.configureTestingModule({
    providers: [
      { provide: WALL_CLOCK, useValue: () => now },
      provideRouter([
        {
          path: '',
          component: ShellHost,
          children: [
            { path: 'a', component: PageA },
            { path: 'b', component: PageB },
          ],
        },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create('/a');
  const shell: unknown = harness.fixture.debugElement.query(
    By.directive(AdminShell),
  ).componentInstance;
  const host: unknown = harness.fixture.debugElement.query(
    By.directive(ShellHost),
  ).componentInstance;
  if (!(shell instanceof AdminShell) || !(host instanceof ShellHost)) {
    throw new Error('Missing shell.');
  }
  return { harness, shell, host };
}

function query(selector: string): HTMLElement | null {
  const element = document.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

/** The open popup of a MenuButton trigger (named by the trigger, or by its header). */
function menuOf(trigger: HTMLElement): Element | null {
  return document.body.querySelector(
    `[role="menu"][aria-labelledby="${trigger.id}"], [role="menu"][aria-labelledby="${trigger.id}-header"]`,
  );
}

async function open(harness: RouterTestingHarness, trigger: HTMLElement | null): Promise<Element> {
  if (!trigger) {
    throw new Error('Missing menu trigger.');
  }
  trigger.click();
  await harness.fixture.whenStable();
  const menu = menuOf(trigger);
  if (!menu) {
    throw new Error('The menu did not open.');
  }
  return menu;
}

/** Opens a topbar menu and chooses the option whose text contains `label`, as a pointer does. */
async function choose(
  harness: RouterTestingHarness,
  trigger: HTMLElement | null,
  label: string,
): Promise<void> {
  const menu = await open(harness, trigger);
  const option = [...menu.querySelectorAll('[role="menuitem"]')].find((item) =>
    item.textContent.includes(label),
  );
  const link = option?.querySelector('.p-menu-item-link');
  if (!(link instanceof HTMLElement)) {
    throw new Error(`Missing option ${label}.`);
  }
  link.click();
  await harness.fixture.whenStable();
}

describe('AdminShell', () => {
  afterEach(() => {
    resize(1024);
    now = start;
    localStorage.removeItem('holita.admin.sidebar');
    vi.restoreAllMocks();
    document.body.querySelectorAll('.p-drawer, .p-overlay-mask, .p-menu').forEach((node) => {
      node.remove();
    });
  });

  it('takes only presentation inputs', () => {
    expect(
      reflectComponentType(AdminShell)
        ?.inputs.map((input) => input.propName)
        .sort(),
    ).toEqual([
      'account',
      'branchId',
      'branches',
      'context',
      'language',
      'languages',
      'loading',
      'navigation',
      'notifications',
      'tenantName',
    ]);
  });

  it('renders landmarks, the breadcrumb and one Branch menu, and persists the rail', async () => {
    const { harness, shell } = await mount();
    expect(query('a.app-skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(query('header.app-topbar')).not.toBeNull();
    expect(query('aside#desktop-navigation')?.getAttribute('aria-label')).toBe('Navigation');
    expect(query('main#main-content')?.getAttribute('tabindex')).toBe('-1');
    expect(query('nav[aria-label="Breadcrumb"] [aria-current="page"]')?.textContent).toBe('Page A');
    expect(query('.app-breadcrumb__group')?.querySelector('a')).toBeNull();
    expect(document.querySelectorAll('#active-branch').length).toBe(1);
    expect(query('.app-sidebar__footer')?.textContent).toContain('RentalSofia');
    const menu = query('.app-topbar__menu');
    expect(menu?.getAttribute('aria-expanded')).toBe('true');
    menu?.click();
    harness.fixture.detectChanges();
    expect(shell.rail()).toBe(true);
    expect(localStorage.getItem('holita.admin.sidebar')).toBe('rail');
    expect(query('.app-shell')?.classList.contains('app-shell--rail')).toBe(true);
    expect(menu?.getAttribute('aria-expanded')).toBe('false');
    expect(query('.app-nav__text')?.classList.contains('app-visually-hidden')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    menu?.click();
    harness.fixture.detectChanges();
    expect(shell.rail()).toBe(false);
  });

  it('emits only known Branches other than the current one', async () => {
    const { host, shell } = await mount();
    shell.chooseBranch('unknown');
    shell.chooseBranch(42);
    shell.chooseBranch(branches[0]?.id);
    shell.chooseBranch(branches[1]?.id);
    expect(host.selected).toEqual([branches[1]?.id]);
  });

  it('switches to the navigation drawer below lg and closes it on navigation and at lg', async () => {
    const { harness, shell } = await mount();
    resize(800);
    harness.fixture.detectChanges();
    expect(shell.mobile()).toBe(true);
    expect(query('aside#desktop-navigation')).toBeNull();
    expect(query('.app-topbar__logo .app-logo__word')?.textContent).toBe('holita');
    expect(document.querySelectorAll('#active-branch').length).toBe(1);
    const menu = query('.app-topbar__menu');
    menu?.click();
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    expect(shell.mobileOpen()).toBe(true);
    expect(query('.p-drawer.app-nav-drawer')?.getAttribute('aria-label')).toBe('Navigation');
    await harness.navigateByUrl('/b');
    expect(shell.mobileOpen()).toBe(false);
    menu?.click();
    harness.fixture.detectChanges();
    expect(shell.mobileOpen()).toBe(true);
    resize(1024);
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    expect(shell.mobileOpen()).toBe(false);
    expect(query('aside#desktop-navigation')).not.toBeNull();
    expect(document.activeElement).toBe(query('.app-topbar__menu'));
  });

  it('moves focus to the new page title after a page change', async () => {
    const { harness } = await mount();
    query('a.app-nav__item[href="/b"]')?.focus();
    await harness.navigateByUrl('/b');
    await harness.fixture.whenStable();
    expect(document.activeElement?.textContent).toBe('B');
    expect(document.activeElement?.id).toBe('page-title');
  });

  it('links the list page from a record page, whose record is the current page', async () => {
    const { harness, host } = await mount();
    host.context.set({
      group: 'Fleet',
      page: 'Page A',
      pageLink: ['/', 'a'],
      record: 'CB 1001 AX',
    });
    await harness.fixture.whenStable();
    const breadcrumb = query('nav[aria-label="Breadcrumb"]');
    const links = breadcrumb?.querySelectorAll('a') ?? [];
    expect([...links].map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Page A', '/a'],
    ]);
    expect(breadcrumb?.querySelector('[aria-current="page"]')?.textContent).toBe('CB 1001 AX');
    expect(query('.app-breadcrumb__group')?.querySelector('a')).toBeNull();
    expect(query('.app-breadcrumb__group')?.textContent.trim()).toBe('Fleet');
  });

  it('disables the Branch menu without Branches and says why', async () => {
    const { harness, host } = await mount();
    host.branches.set([]);
    await harness.fixture.whenStable();
    const trigger = query('.app-topbar__branch button');
    expect(trigger?.getAttribute('aria-disabled')).toBe('true');
    expect(query('#active-branch')?.textContent).toBe('No branches available.');
    trigger?.click();
    await harness.fixture.whenStable();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('reports the language, notification and account choices', async () => {
    const { harness, host } = await mount();
    // The theme item toggles the appearance; the stub keeps the preference out of storage.
    const toggle = vi.spyOn(TestBed.inject(Appearance), 'toggle').mockImplementation(() => {
      /* not persisted */
    });
    const language = query('.app-topbar__language-label')?.closest('button') ?? null;
    await choose(harness, language, 'English');
    await choose(harness, language, 'Български');
    await choose(harness, query('button.app-topbar__bell'), 'Engine alert');
    await choose(harness, query('button.app-topbar__bell'), 'Mark all as read');
    await choose(harness, query('button.app-topbar__account'), 'theme');
    await choose(harness, query('button.app-topbar__account'), 'Sign out');
    // The current language again is not a change.
    expect(host.events).toEqual(['language bg', 'open n1', 'read', 'sign out']);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('dates the notifications from the moment the bell opens', async () => {
    const { harness } = await mount();
    const bell = query('button.app-topbar__bell');
    let menu = await open(harness, bell);
    expect(menu.querySelector('.menu-button__note')?.textContent).toBe('just now');
    bell?.click();
    await harness.fixture.whenStable();
    now += 60 * 60_000;
    menu = await open(harness, bell);
    expect(menu.querySelector('.menu-button__note')?.textContent).toBe('1 h ago');
  });

  it('states an empty notification list in the heading that names the bell menu', async () => {
    const { harness, host } = await mount();
    host.notifications.set([]);
    await harness.fixture.whenStable();
    const bell = query('button.app-topbar__bell');
    expect(bell?.textContent.trim()).toBe('Notifications');
    const menu = await open(harness, bell);
    const heading = document.getElementById(menu.getAttribute('aria-labelledby') ?? '');
    expect(heading?.textContent).toBe('No new notifications');
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });
});
