import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { StoreWorkspace } from '../stores/store-workspace';
import { ProductsPage } from './products-page';
import { ProductEditor } from './product-editor';

@Component({
  selector: 'holita-store-products',
  imports: [ProductsPage, ProductEditor, Message],
  template: `
    <!-- Recreate the client/form on store, language or editor identity changes, even when Angular reuses the route. -->
    @for (
      scope of activeWorkspaces();
      track scope.language + '/' + scope.store.id + '/' + scope.productId
    ) {
      @if (scope.editor) {
        <holita-product-editor
          [store]="scope.store"
          [language]="scope.language"
          [productId]="scope.productId"
        />
      } @else {
        <holita-products-page [store]="scope.store" [language]="scope.language" />
      }
    } @empty {
      <section class="card">
        <p-message severity="error">{{ workspace.text().unavailableStore }}</p-message>
      </section>
    }
  `,
})
export class StoreProducts {
  readonly workspace = inject(StoreWorkspace);
  private readonly editor = viewChild(ProductEditor);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeWorkspaces = computed(() => {
    const language = this.workspace.language();
    const id = this.params().get('storeId')?.toLowerCase();
    const store = this.workspace.stores()?.find((store) => store.id === id);
    const editor = this.route.snapshot.data['editor'] === true;
    const productId = this.params().get('productId');
    return store ? [{ store, language, editor, productId }] : [];
  });

  canLeave(): boolean | Promise<boolean> {
    return this.editor()?.canLeave() ?? true;
  }
}
