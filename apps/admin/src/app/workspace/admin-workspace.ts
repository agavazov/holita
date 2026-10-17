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

@Component({
  selector: 'holita-admin-workspace',
  imports: [RouterOutlet, AdminShell, ButtonDirective, Message, Login],
  providers: [BranchContext],
  templateUrl: './admin-workspace.html',
})
export class AdminWorkspace {
  readonly session = inject(DemoSession);
  readonly branches = inject(BranchContext);
  readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly primeNG = inject(PrimeNG);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly text = computed(() => messages[this.language()]);
  readonly branchFailure = computed(() =>
    requestError(this.branches.error(), this.text().networkError),
  );
  readonly otherLanguageUrl = computed(() => {
    this.navigation();
    return this.languageLink(this.language() === 'bg' ? 'en' : 'bg');
  });

  constructor() {
    effect((onCleanup) => {
      const language = this.language();
      document.documentElement.lang = language;
      const text = messages[language];
      this.primeNG.setTranslation({
        selectionMessage: text.selectedItemsMessage,
        emptySelectionMessage: text.emptySelectionMessage,
        aria: {
          ...this.primeNG.translation.aria,
          previous: text.previousSection,
          next: text.nextSection,
          firstPageLabel: text.firstPageLabel,
          prevPageLabel: text.prevPageLabel,
          nextPageLabel: text.nextPageLabel,
          lastPageLabel: text.lastPageLabel,
          pageLabel: text.pageLabel,
          rowsPerPageLabel: text.rowsPerPageLabel,
        },
      });
      const close = this.branches.watch(language);
      if (close) onCleanup(close);
    });
    effect(() => {
      this.branches.synchronizeRoute(this.language());
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

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
