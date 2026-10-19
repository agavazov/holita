import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AdminDemoLoginMutation } from '../../../generated/graphql/operations';
import { Login } from '../../../app/features/auth/login';
import { ExampleApp } from '../example-app';

type LoginSelection = {
  readonly session: AdminDemoLoginMutation['demoLogin'];
  readonly branchId: string;
};

/** Uses the real Login and opens the sample Fleet once its signedIn output settles. */
@Component({
  selector: 'holita-example-login-page',
  imports: [Login, ExampleApp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selection(); as selected) {
      <holita-example-app
        url="/examples/vehicles"
        [branchId]="selected.branchId"
        [tenant]="selected.session.tenant.name"
        (signedOut)="selection.set(null)"
      />
    } @else {
      <holita-login language="en" [languageUrl]="languageUrl" (signedIn)="selection.set($event)" />
    }
  `,
})
export class LoginPage {
  protected readonly selection = signal<LoginSelection | null>(null);
  // Storybook keeps one language, like the sample shell's language menu.
  protected readonly languageUrl = inject(Router).createUrlTree(['/en']);
}
