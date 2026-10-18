import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, NavigationEnd, RouterOutlet, UrlSegment } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { PrimeNG } from 'primeng/config';
import { DemoSession } from '../core/auth/demo-session';
import { AdminConfig } from '../core/config/admin-config';
import { requestError } from '../core/graphql/request-error';
import { Login } from '../features/auth/login';
import { BranchContext } from '../features/branches/branch-context';
import { messages, readLanguage, type Language } from '../i18n/messages';
import { AdminShell } from '../layout/admin-shell';
import type { LanguageOption } from '../layout/admin-topbar';
import { navigationContext } from '../layout/navigation';
import { PageRecord } from '../layout/page-record';
import { UI_LANGUAGE } from '../ui/ui-language';
import { adminNavigation } from './admin-navigation';
import { primeNgTranslation } from './primeng-translation';

@Component({
  selector: 'holita-admin-workspace',
  imports: [RouterOutlet, AdminShell, ButtonDirective, Message, Login],
  providers: [
    BranchContext,
    { provide: UI_LANGUAGE, useFactory: () => inject(AdminWorkspace).language },
  ],
  templateUrl: './admin-workspace.html',
})
export class AdminWorkspace {
  readonly session = inject(DemoSession);
  readonly branches = inject(BranchContext);
  readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly primeNG = inject(PrimeNG);
  private readonly pageRecord = inject(PageRecord);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly text = computed(() => messages[this.language()]);
  readonly branchFailure = computed(() =>
    requestError(this.branches.error(), this.text().networkError),
  );
  readonly otherLanguageUrl = computed(() => {
    this.navigationEnd();
    return this.languageLink(this.language() === 'bg' ? 'en' : 'bg');
  });
  /** The supported interface languages, each labelled in its own language. */
  readonly languages: readonly LanguageOption[] = [
    { code: 'bg', label: 'Български' },
    { code: 'en', label: 'English' },
  ];
  readonly navigation = computed(() =>
    adminNavigation(this.language(), this.branches.selectedId(), this.fleetEnabled),
  );
  /**
   * The topbar context: the navigation item whose link is the longest prefix of the path, and the
   * record a record page registered.
   */
  readonly context = computed(() => {
    this.navigationEnd();
    const primary = this.router.parseUrl(this.router.url).root.children['primary'];
    const path = `/${(primary?.segments ?? []).map((segment) => segment.path).join('/')}`;
    const context = navigationContext(this.navigation(), path);
    return context ? { ...context, record: this.pageRecord.label() } : null;
  });

  constructor() {
    effect((onCleanup) => {
      const language = this.language();
      document.documentElement.lang = language;
      this.primeNG.setTranslation(primeNgTranslation(language, this.primeNG.translation.aria));
      const close = this.branches.watch(language);
      if (close) onCleanup(close);
    });
    effect(() => {
      this.branches.synchronizeRoute(this.language());
    });
    effect(() => {
      const text = this.text();
      const page = this.session.current() ? this.context()?.page : text.signIn;
      document.title = page ? `${page} · holita` : 'holita';
    });
  }

  async logout(): Promise<void> {
    // Route navigation runs the dirty-editor guard before retiring the session.
    const resumeDefaultNavigation = this.branches.pauseDefaultNavigation();
    try {
      if (await this.router.navigate(['/', this.language()])) {
        this.branches.clear();
        this.session.logout();
      }
    } finally {
      resumeDefaultNavigation();
    }
  }

  changeLanguage(code: string): void {
    if (code === 'bg' || code === 'en') void this.router.navigateByUrl(this.languageLink(code));
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
