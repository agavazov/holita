import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { StoreWorkspace } from '../stores/store-workspace';
import { ProductsPage } from './products-page';

@Component({
  selector: 'holita-store-products',
  imports: [ProductsPage, Message],
  template: `
    <!-- Angular reuses routes; this key recreates the page and its client/cache on store or language changes. -->
    @for (scope of activeWorkspaces(); track scope.language + '/' + scope.store.id) {
      <holita-products-page [store]="scope.store" [language]="scope.language" />
    } @empty {
      <section class="card">
        <p-message severity="error">{{ workspace.text().unavailableStore }}</p-message>
      </section>
    }
  `,
})
export class StoreProducts {
  readonly workspace = inject(StoreWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeWorkspaces = computed(() => {
    const language = this.workspace.language();
    const id = this.params().get('storeId')?.toLowerCase();
    const store = this.workspace.stores()?.find((store) => store.id === id);
    return store ? [{ store, language }] : [];
  });
}
