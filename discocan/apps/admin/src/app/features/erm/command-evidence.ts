import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { interpolate } from '@osnova/ui';
import type { Language } from '../../i18n/messages';
import { commandText, type CommandRequest } from '../fleet/commands/command-presentation';

@Component({
  selector: 'discocan-erm-command-evidence',
  templateUrl: './command-evidence.html',
  styleUrl: '../fleet/commands/command-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: contents; }',
})
export class ErmCommandEvidence {
  readonly request = input.required<CommandRequest>();
  readonly language = input.required<Language>();
  readonly section = input.required<'verification' | 'technical'>();
  protected readonly text = computed(() => commandText[this.language()]);
  protected readonly actionCode = computed(() => {
    const code = this.request().actionCode;
    return code === 'READ_FAULTS'
      ? 'READ_EDATA_FAULTS'
      : code === 'READ_DIAGNOSTICS'
        ? 'READ_EDATA_DIAGNOSTICS'
        : code;
  });
  protected readonly confirmation = computed(() => {
    const acknowledgement = this.request().transportCommand?.acknowledgement;
    return acknowledgement?.erm
      ? interpolate(this.text().confirmation, {
          reference: acknowledgement.erm.commandReference,
          result: acknowledgement.resultCode,
        })
      : null;
  });
}
