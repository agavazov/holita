import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, NavigationEnd, RouterOutlet, UrlSegment } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { PrimeNG } from 'primeng/config';
import { AdminShell } from '../../layout/admin-shell';
import type { AdminBranchesQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, readLanguage, type Language } from '../../i18n/messages';
import { BranchesApi } from './branches-api';
import { DemoSession } from '../../core/auth/demo-session';
import type { AdminDemoLoginMutation } from '../../../generated/graphql/operations';
import { Login } from '../auth/login';
import { AdminConfig } from '../../core/config/admin-config';

@Component({
  selector: 'holita-branch-workspace',
  imports: [RouterOutlet, AdminShell, ButtonDirective, Message, Login],
  templateUrl: './branch-workspace.html',
})
export class BranchWorkspace {
  readonly session = inject(DemoSession);
  readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BranchesApi);
  private readonly primeNG = inject(PrimeNG);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private signingOut = false;
  private discoveryToken: string | null = null;
  private query: ReturnType<BranchesApi['watch']>['query'] | undefined;
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly text = computed(() => messages[this.language()]);
  readonly branches = signal<AdminBranchesQuery['branches'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly branchesAvailable = computed(() => (this.branches()?.length ?? 0) > 0);
  readonly selectedBranchId = computed(() => {
    this.navigation();
    const id = this.karmaActive()
      ? this.session.branchId()
      : this.route.firstChild?.snapshot.paramMap.get('branchId')?.toLowerCase();
    return this.branches()?.find((branch) => branch.id === id)?.id ?? null;
  });
  readonly otherLanguageUrl = computed(() => {
    this.navigation();
    return this.languageLink(this.language() === 'bg' ? 'en' : 'bg');
  });
  readonly karmaActive = computed(() => {
    this.navigation();
    return this.route.firstChild?.snapshot.data['feature'] === 'karma-client';
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
      const session = this.session.current();
      if ((session?.token ?? null) !== this.discoveryToken) {
        this.branches.set(null);
        this.discoveryToken = session?.token ?? null;
      }
      if (!session) return;
      this.loading.set(true);
      this.error.set(null);
      const { query, close } = this.api.watch(language);
      this.query = query;
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete') this.branches.set(result.data.branches);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        close();
        this.query = undefined;
      });
    });
    effect(() => {
      this.navigation();
      const branches = this.branches();
      const selected = this.selectedBranchId();
      if (this.session.current() && branches?.length) {
        if (selected) this.session.selectBranch(selected);
        else if (!this.route.firstChild && !this.signingOut) {
          const branch =
            branches.find((branch) => branch.id === this.session.branchId()) ?? branches[0];
          if (branch)
            void this.router.navigate(['/', this.language(), branch.id, 'fleet', 'vehicles'], {
              replaceUrl: true,
            });
        }
      }
    });
  }

  async enter(selection: {
    session: AdminDemoLoginMutation['demoLogin'];
    branchId: string;
  }): Promise<void> {
    const destination = this.router.createUrlTree([
      '/',
      this.language(),
      selection.branchId,
      'fleet',
      'vehicles',
    ]);
    if (
      this.router.url === this.router.serializeUrl(destination) ||
      (await this.router.navigateByUrl(destination))
    ) {
      this.session.start(selection.session, selection.branchId);
    }
  }

  async logout(): Promise<void> {
    // Route navigation runs the dirty-editor guard before retiring the session.
    this.signingOut = true;
    try {
      if (await this.router.navigate(['/', this.language()])) {
        this.branches.set(null);
        this.session.logout();
      }
    } finally {
      this.signingOut = false;
    }
  }

  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (this.query === query) this.error.set(error);
    });
  }

  chooseBranch(id: string): void {
    if (this.karmaActive()) {
      this.session.selectBranch(id);
      return;
    }
    const section = this.route.firstChild?.snapshot.url;
    const resource = section?.[2]?.path;
    const fleet =
      this.fleetEnabled &&
      section?.[1]?.path === 'fleet' &&
      (resource === 'vehicles' || resource === 'devices');
    void this.router.navigate(['/', this.language(), id, 'fleet', fleet ? resource : 'vehicles']);
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
