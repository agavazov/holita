import { Component, computed, inject } from '@angular/core';
import { StoreWorkspace } from '../stores/store-workspace';
import { CarsPage } from './cars-page/cars-page';

@Component({
  selector: 'holita-karma-workspace',
  imports: [CarsPage],
  template: `
    @for (scope of scopes(); track scope.token + ':' + scope.language) {
      <holita-karma-cars-page [language]="scope.language" />
    }
  `,
})
export class KarmaWorkspace {
  private readonly workspace = inject(StoreWorkspace);
  readonly scopes = computed(() => {
    const session = this.workspace.session.current();
    return session ? [{ token: session.token, language: this.workspace.language() }] : [];
  });
}
