import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  type IsActiveMatchOptions,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { PageHeader } from '../../../ui/page-header/page-header';
import { MenuButton, type MenuOption } from '../../../ui/menu-button/menu-button';
import type { Language } from '../../../i18n/messages';
import { injectPageRecord } from '../../../layout/page-record';
import { karmaCarNavigationContext, karmaCarReturnQuery } from './karma-car-context';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  imports: [PageHeader, RouterLink, RouterLinkActive, ButtonDirective, MenuButton],
  selector: 'holita-karma-car-header',
  styleUrl: './karma-car-header.scss',
  templateUrl: './karma-car-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KarmaCarHeader {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly carNumber = input<string | null>();
  readonly title = input.required<string>();
  readonly canNavigate = input(true);
  readonly busy = input(false);
  readonly error = input(false);
  readonly refreshDisabled = input(false);
  readonly showRefresh = input(true);
  readonly showSourceIdentity = input(true);
  readonly refreshRequest = output();
  protected readonly text = computed(() => catalogs[this.language()]);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly query = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams,
  });
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly returnQuery = computed(() => karmaCarReturnQuery(this.params()));
  protected readonly identity = computed(
    () =>
      this.carNumber() ||
      (this.showSourceIdentity() ? `${this.text().truck} · ${this.carId()}` : this.text().truck),
  );
  protected readonly description = computed(() =>
    this.showSourceIdentity() ? `${this.text().carId}: ${this.carId()}` : null,
  );
  protected readonly tabs = computed(() => [
    { path: '', label: this.text().overview },
    { path: 'trips', label: this.text().trips },
    { path: 'location', label: this.text().location },
  ]);
  protected readonly moreOptions = computed<readonly MenuOption[]>(() =>
    [
      { id: 'events', label: this.text().events },
      { id: 'diagnostics', label: this.text().diagnostics },
      { id: 'edata', label: this.text().edata },
      { id: 'driving-profile', label: this.text().drivingProfile },
      { id: 'configuration', label: this.text().deviceSettings },
    ].map((option) => ({
      ...option,
      link: this.destination(option.id),
      selected: this.isCurrent(option.id),
    })),
  );
  protected readonly moreLabel = computed(() => {
    const current = this.moreOptions().find((option) => option.selected);
    return current ? `${this.text().more}: ${current.label}` : this.text().more;
  });
  protected readonly moreActive = computed(() =>
    this.moreOptions().some((option) => option.selected),
  );
  protected readonly sectionTitle = computed(
    () =>
      this.tabs().find((tab) => this.isCurrent(tab.path))?.label ??
      this.moreOptions().find((option) => option.selected)?.label ??
      this.title(),
  );
  protected readonly activeMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  constructor() {
    injectPageRecord(
      () => this.carNumber() || null,
      () =>
        this.router.createUrlTree(['/', this.language(), 'karma-client', 'cars'], {
          queryParams: this.returnQuery(),
        }),
    );
  }

  protected destination(path: string) {
    const commands = ['/', this.language(), 'karma-client', 'cars', this.carId()];
    if (path) {
      commands.push(path);
    }
    return this.router.createUrlTree(commands, {
      queryParams: this.isCurrent(path) ? this.query() : karmaCarNavigationContext(this.params()),
      ...(this.isCurrent(path) ? { preserveFragment: true } : {}),
    });
  }

  private isCurrent(path: string): boolean {
    const segments = this.router.parseUrl(this.url()).root.children['primary']?.segments ?? [];
    const current = segments.at(-1)?.path;
    return path ? current === path : current === this.carId();
  }
}
