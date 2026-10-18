import { Component, reflectComponentType, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterOutlet, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AdminShell } from './admin-shell';
import type { NavGroup } from './navigation';

const branches = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Discordia' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Sandbox' },
];
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
      [branches]="branches"
      [branchId]="branchId()"
      language="en"
      [languages]="languages"
      [navigation]="navigation"
      [context]="{ group: 'Fleet', page: 'Page A' }"
      tenantName="RentalSofia"
      (branchSelected)="selected.push($event)"
    >
      <router-outlet />
    </holita-admin-shell>
  `,
})
class ShellHost {
  readonly branches = branches;
  readonly navigation = navigation;
  readonly branchId = signal<string | null>(branches[0]?.id ?? null);
  readonly languages = [
    { code: 'bg', label: 'Български' },
    { code: 'en', label: 'English' },
  ];
  readonly selected: string[] = [];
}

function resize(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

async function mount() {
  TestBed.configureTestingModule({
    providers: [
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
  if (!(shell instanceof AdminShell) || !(host instanceof ShellHost))
    throw new Error('Missing shell.');
  return { harness, shell, host };
}

function query(selector: string): HTMLElement | null {
  const element = document.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

describe('AdminShell', () => {
  afterEach(() => {
    resize(1024);
    localStorage.removeItem('holita.admin.sidebar');
    vi.restoreAllMocks();
    document.body.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((node) => {
      node.remove();
    });
  });

  it('takes only presentation inputs', () => {
    expect(
      reflectComponentType(AdminShell)
        ?.inputs.map((input) => input.propName)
        .sort(),
    ).toEqual([
      'branchId',
      'branches',
      'context',
      'language',
      'languages',
      'loading',
      'navigation',
      'tenantName',
    ]);
  });

  it('renders landmarks, context and one Branch select, and persists the rail', async () => {
    const { harness, shell } = await mount();
    expect(query('a.app-skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(query('header.app-topbar')).not.toBeNull();
    expect(query('aside#desktop-navigation')?.getAttribute('aria-label')).toBe('Navigation');
    expect(query('main#main-content')?.getAttribute('tabindex')).toBe('-1');
    expect(query('.app-topbar__page')?.textContent).toBe('Page A');
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

  it('emits only known Branches', async () => {
    const { host, shell } = await mount();
    shell.chooseBranch('unknown');
    shell.chooseBranch(42);
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
});
