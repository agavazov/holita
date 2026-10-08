import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { Message } from 'primeng/message';
import { StoreWorkspace } from '../../stores/store-workspace';
import { BodyExamples } from './body-examples/body-examples';
import { ListExamples } from './list-examples/list-examples';
import { FormExamples } from './form-examples/form-examples';
import { StateExamples } from './state-examples/state-examples';

@Component({
  selector: 'holita-ui-catalog',
  imports: [TabsModule, Message, BodyExamples, ListExamples, FormExamples, StateExamples],
  templateUrl: './ui-catalog.html',
  styleUrl: './ui-catalog.scss',
})
export class UiCatalog {
  readonly workspace = inject(StoreWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly section = computed(() => {
    const tab = this.query().get('tab');
    return tab === 'lists' || tab === 'forms' || tab === 'states' ? tab : 'body';
  });
  readonly scopes = computed(() => {
    const language = this.workspace.language();
    const store = this.workspace
      .stores()
      ?.find((row) => row.id === this.params().get('storeId')?.toLowerCase());
    return store ? [{ key: store.id + '/' + language, language }] : [];
  });

  changeSection(value: unknown): void {
    if (value !== 'body' && value !== 'lists' && value !== 'forms' && value !== 'states') return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: value === 'body' ? {} : { tab: value },
    });
  }
}
