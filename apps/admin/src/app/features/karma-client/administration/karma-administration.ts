import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { messages, type Language } from '../../../i18n/messages';
import { PageHeader } from '../../../ui/page-header/page-header';
import { UsersPage } from '../accounts/users-page/users-page';
import { RolesPage } from '../accounts/roles-page/roles-page';
import { ProjectsPage } from '../references/projects-page/projects-page';
import { TimeZonesPage } from '../references/time-zones-page/time-zones-page';
import { ApiInfoPage } from '../references/api-info-page/api-info-page';

/** Account navigation mounts only the active existing read-only resource screen. */
@Component({
  selector: 'holita-karma-administration',
  imports: [
    RouterLink,
    RouterLinkActive,
    PageHeader,
    UsersPage,
    RolesPage,
    ProjectsPage,
    TimeZonesPage,
    ApiInfoPage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    <holita-page-header
      [eyebrow]="text().karmaAccount"
      [title]="text().karmaAdministrationTitle"
      [description]="text().karmaAdministrationDescription"
    />
    <nav [attr.aria-label]="text().karmaAdministration">
      <ul class="app-route-nav" role="list">
        @for (tab of tabs(); track tab.path) {
          <li>
            <a
              class="app-route-nav__link"
              [routerLink]="['/', language(), 'karma-client', 'administration', tab.path]"
              [queryParamsHandling]="tab.path === section() ? 'preserve' : 'replace'"
              [preserveFragment]="tab.path === section()"
              routerLinkActive="app-route-nav__link--active"
              ariaCurrentWhenActive="page"
              >{{ tab.label }}</a
            >
          </li>
        }
      </ul>
    </nav>
    @switch (section()) {
      @case ('users') {
        <holita-users-page [language]="language()" />
      }
      @case ('roles') {
        <holita-roles-page [language]="language()" />
      }
      @case ('projects') {
        <holita-projects-page [language]="language()" />
      }
      @case ('time-zones') {
        <holita-time-zones-page [language]="language()" />
      }
      @case ('api-info') {
        <holita-api-info-page [language]="language()" />
      }
    }
  `,
})
export class KarmaAdministration {
  readonly language = input.required<Language>();
  readonly section = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly tabs = computed(() => [
    { path: 'users', label: this.text().karmaUsers },
    { path: 'roles', label: this.text().karmaRoles },
    { path: 'projects', label: this.text().karmaProjects },
    { path: 'time-zones', label: this.text().karmaTimeZones },
    { path: 'api-info', label: this.text().karmaApiInfo },
  ]);
}
