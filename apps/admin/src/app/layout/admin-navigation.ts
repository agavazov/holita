import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Shop } from '@primeicons/angular/shop';
import { Box } from '@primeicons/angular/box';
import { Users } from '@primeicons/angular/users';
import { Car } from '@primeicons/angular/car';
import { Calendar } from '@primeicons/angular/calendar';
import { Tag } from '@primeicons/angular/tag';
import { MapMarker } from '@primeicons/angular/map-marker';
import { messages, type Language } from '../i18n/messages';

@Component({
  selector: 'holita-admin-navigation',
  imports: [RouterLink, RouterLinkActive, Shop, Box, MapMarker, Users, Tag, Calendar, Car],
  template: `
    <nav [attr.aria-label]="text().navigation">
      <ul class="layout-menu">
        <li class="layout-root-menuitem">
          <div class="layout-menuitem-root-text">{{ text().workspace }}</div>
          <ul>
            <li>
              <a
                [routerLink]="['/', language()]"
                routerLinkActive="active-route"
                [routerLinkActiveOptions]="{
                  paths: 'exact',
                  queryParams: 'ignored',
                  matrixParams: 'ignored',
                  fragment: 'ignored',
                }"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="shop"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span class="layout-menuitem-text">{{ text().storesNavigation }}</span>
              </a>
            </li>
            @if (storeId(); as id) {
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'products']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="box"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().products }}</span>
                </a>
              </li>
            }
          </ul>
        </li>
        @if (referenceEnabled() && storeId(); as id) {
          <li class="layout-root-menuitem">
            <div class="layout-menuitem-root-text">{{ text().reference }}</div>
            <ul>
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'reference', 'venues']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="map-marker"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().venues }}</span>
                </a>
              </li>
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'reference', 'speakers']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="users"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().speakers }}</span>
                </a>
              </li>
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'reference', 'tags']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                >
                  <svg
                    data-p-icon="tag"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().tags }}</span>
                </a>
              </li>
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'reference', 'vehicles']"
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
                  [routerLink]="['/', language(), 'stores', id, 'reference', 'events']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                  ><svg
                    data-p-icon="calendar"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg
                  ><span class="layout-menuitem-text">{{ text().events }}</span></a
                >
              </li>
            </ul>
          </li>
        }
        @if (prototype() && storeId(); as id) {
          <li class="layout-root-menuitem">
            <div class="layout-menuitem-root-text">{{ text().prototypeMode }}</div>
            <ul>
              <li>
                <a
                  [routerLink]="['/', language(), 'stores', id, 'ui-catalog']"
                  routerLinkActive="active-route"
                  ariaCurrentWhenActive="page"
                  ><svg
                    data-p-icon="box"
                    size="20"
                    class="layout-menuitem-icon"
                    aria-hidden="true"
                  ></svg>
                  <span class="layout-menuitem-text">{{ text().catalogTitle }}</span>
                </a>
              </li>
            </ul>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class AdminNavigation {
  readonly language = input.required<Language>();
  readonly storeId = input<string | null>(null);
  readonly referenceEnabled = input(false);
  readonly prototype = input(false);
  readonly text = computed(() => messages[this.language()]);
}
