import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Ban } from '@primeicons/angular/ban';
import { CheckCircle } from '@primeicons/angular/check-circle';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Inbox } from '@primeicons/angular/inbox';
import { QuestionCircle } from '@primeicons/angular/question-circle';
import { Search } from '@primeicons/angular/search';
import { Wifi } from '@primeicons/angular/wifi';

export type EmptyStateKind =
  'empty' | 'no-results' | 'error' | 'not-found' | 'disabled' | 'no-telemetry' | 'done';

/** Icon, title, description and actions for every "nothing to show" situation. */
@Component({
  selector: 'holita-empty-state',
  imports: [Ban, CheckCircle, ExclamationTriangle, Inbox, QuestionCircle, Search, Wifi],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'role()',
    '[class.empty-state--compact]': 'compact()',
    '[attr.data-kind]': 'kind()',
  },
})
export class EmptyState {
  readonly kind = input<EmptyStateKind>('empty');
  readonly title = input.required<string>();
  readonly description = input<string | null | undefined>(null);
  readonly compact = input(false);

  protected readonly role = computed(() =>
    this.kind() === 'error' || this.kind() === 'not-found' ? 'alert' : 'status',
  );
}
