import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ErmPage } from './erm-page';

@Component({
  selector: 'holita-erm-workspace',
  imports: [ErmPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (scope of scopes(); track scope.token + ':' + scope.language + ':' + scope.unitId) {
      <holita-erm-page [language]="scope.language" [unitId]="scope.unitId" />
    }
  `,
})
export class ErmWorkspace {
  private readonly workspace = inject(AdminWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly scopes = computed(() => {
    const session = this.workspace.session.current();
    return session
      ? [
          {
            token: session.token,
            language: this.workspace.language(),
            unitId: this.params().get('unitId'),
          },
        ]
      : [];
  });
}
