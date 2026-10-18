import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { EmptyState } from '../../../app/ui/empty-state/empty-state';
import { PageHeader } from '../../../app/ui/page-header/page-header';

/** Stands in for an example page that is not built yet. */
@Component({
  selector: 'holita-example-placeholder',
  imports: [PageHeader, EmptyState],
  template: `
    <holita-page-header eyebrow="Example" [title]="title()" />
    <holita-empty-state
      kind="empty"
      title="This example page is being built"
      description="It will use the same patterns as the Vehicles example."
    />
  `,
})
export class ExamplePlaceholder {
  readonly title = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => String(data['title'] ?? 'Example'))),
    { initialValue: 'Example' },
  );
}
