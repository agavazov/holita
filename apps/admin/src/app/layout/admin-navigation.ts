import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Shop } from '@primeicons/angular/shop';
import { Box } from '@primeicons/angular/box';
import { messages, type Language } from '../i18n/messages';

@Component({
  selector: 'holita-admin-navigation',
  imports: [RouterLink, RouterLinkActive, Shop, Box],
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
                [routerLinkActiveOptions]="{ exact: true }"
                ariaCurrentWhenActive="page"
              >
                <svg
                  data-p-icon="shop"
                  size="20"
                  class="layout-menuitem-icon"
                  aria-hidden="true"
                ></svg>
                <span>{{ text().storesNavigation }}</span>
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
                  <span>{{ text().products }}</span>
                </a>
              </li>
            }
          </ul>
        </li>
      </ul>
    </nav>
  `,
})
export class AdminNavigation {
  readonly language = input.required<Language>();
  readonly storeId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
}
