import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Mobile } from '@primeicons/angular/mobile';
import { Car } from '@primeicons/angular/car';
import { Clock } from '@primeicons/angular/clock';
import { Folder } from '@primeicons/angular/folder';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { Shield } from '@primeicons/angular/shield';
import { Users } from '@primeicons/angular/users';
import { messages, type Language } from '../i18n/messages';

@Component({
  selector: 'holita-admin-navigation',
  imports: [RouterLink, RouterLinkActive, Car, Mobile, Clock, Folder, InfoCircle, Shield, Users],
  template: `
    <nav [attr.aria-label]="text().navigation">
      <ul class="layout-menu">
        @if (fleetEnabled() && branchId(); as id) {
          <li class="layout-root-menuitem">
            <div class="layout-menuitem-root-text">{{ text().fleet }}</div>
            <ul>
              <li>
                <a
                  [routerLink]="['/', language(), id, 'fleet', 'vehicles']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="car"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().vehicles }}</span>
                </a>
              </li>
              <li>
                <a
                  [routerLink]="['/', language(), id, 'fleet', 'devices']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="mobile"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().devices }}</span>
                </a>
              </li>
            </ul>
          </li>
        }
        <li class="layout-root-menuitem">
          <div class="layout-menuitem-root-text">{{ text().karmaClient }}</div>
          <ul>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'cars']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="car"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaTrucks }}</span>
              </a>
            </li>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'users']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="users"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaUsers }}</span>
              </a>
            </li>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'roles']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="shield"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaRoles }}</span>
              </a>
            </li>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'projects']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="folder"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaProjects }}</span>
              </a>
            </li>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'time-zones']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="clock"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaTimeZones }}</span>
              </a>
            </li>
            <li>
              <a
                [routerLink]="['/', language(), 'karma-client', 'api-info']"
                routerLinkActive="active-route"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="info-circle"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().karmaApiInfo }}</span>
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  `,
})
export class AdminNavigation {
  readonly language = input.required<Language>();
  readonly branchId = input<string | null>(null);
  readonly fleetEnabled = input(false);
  readonly text = computed(() => messages[this.language()]);
}
