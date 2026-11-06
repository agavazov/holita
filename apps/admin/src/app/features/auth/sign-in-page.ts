import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { DemoSession, type AccountSession } from '../../core/auth/demo-session';
import { messages, readLanguage } from '../../i18n/messages';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { primeNgTranslation } from '../../workspace/primeng-translation';
import { Login } from './login';

@Component({
  selector: 'holita-sign-in-page',
  imports: [Login],
  providers: [{ provide: UI_LANGUAGE, useFactory: () => inject(SignInPage).language }],
  template:
    '<holita-login [language]="language()" [languageUrl]="otherLanguageUrl()" (signedIn)="enter($event)" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(DemoSession);
  private readonly primeNG = inject(PrimeNG);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly otherLanguageUrl = computed(() =>
    this.router.createUrlTree(['/', this.language() === 'bg' ? 'en' : 'bg', 'sign-in']),
  );
  constructor() {
    effect(() => {
      const language = this.language();
      document.documentElement.lang = language;
      document.title = `${messages[language].signIn} · holita`;
      this.primeNG.setTranslation(primeNgTranslation(language, this.primeNG.translation.aria));
    });
    effect(() => {
      if (this.session.current()) {
        const branchId = this.session.branchId();
        void this.router.navigate(
          branchId
            ? ['/', this.language(), branchId, 'fleet', 'dashboard', 'overview']
            : ['/', this.language()],
          { replaceUrl: true },
        );
      }
    });
  }
  async enter(selection: { session: AccountSession; branchId: string }): Promise<void> {
    if (
      await this.router.navigate([
        '/',
        this.language(),
        selection.branchId,
        'fleet',
        'dashboard',
        'overview',
      ])
    ) {
      this.session.start(selection.session, selection.branchId);
    }
  }
}
