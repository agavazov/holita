import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { StoreWorkspace } from '../stores/store-workspace';
import { ProductsPage } from './products-page';

@Component({
  selector: 'holita-store-products',
  imports: [ProductsPage],
  template: `
    @for (store of activeStores(); track workspace.language() + '/' + store.id) {
      <holita-products-page [store]="store" [language]="workspace.language()" />
    } @empty {
      <p role="alert">{{ workspace.text().unavailableStore }}</p>
    }
  `,
})
export class StoreProducts {
  readonly workspace = inject(StoreWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeStores = computed(() => {
    const id = this.params().get('storeId')?.toLowerCase();
    return (this.workspace.stores() ?? []).filter((store) => store.id === id);
  });
}
