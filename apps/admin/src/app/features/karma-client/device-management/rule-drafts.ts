import { Injectable, signal } from '@angular/core';
import {
  decodeRuleData,
  decodeRuleRecord,
  editableRuleExpression,
  encodeRuleData,
  encodeRuleRecord,
  parseRuleExpression,
  referencedParameterIds,
  renderRuleExpression,
  type RuleRecord,
} from '@holita/edata-rules';
import type { DeviceConfigurationOperation } from '../../fleet/device-operations/device-configuration-types';
import { randomUuid } from '../../../core/random-uuid';

export interface RuleDraft {
  readonly id: string;
  readonly name: string;
  readonly ruleId?: number;
  readonly expression: string;
  readonly trueEvent: number;
  readonly falseEvent: number;
  readonly debounce: number;
  readonly activateDashboard?: boolean;
  readonly sourceHex?: string;
  readonly sourceExpression?: string;
  readonly sourceSection?: string;
  readonly opaque?: boolean;
  readonly confirmed?: boolean;
  readonly catalogVersion?: string;
}
export interface RuleParameterName {
  readonly id: number;
  readonly name: string;
}
export interface RuleImport {
  readonly filename: string;
  readonly original: string;
  readonly rules: RuleDraft[];
  readonly parameters: RuleParameterName[];
  readonly issues: string[];
}

export function draftRecord(draft: RuleDraft): RuleRecord {
  if (draft.ruleId === undefined) {
    throw new Error('RULE_ID_REQUIRED');
  }
  return {
    ruleId: draft.ruleId,
    trueEventId: draft.trueEvent,
    falseEventId: draft.falseEvent,
    debounceMilliseconds: draft.debounce,
    activateDashboard: draft.activateDashboard ?? false,
    ruleDataHex:
      draft.sourceHex && (draft.opaque || draft.expression === draft.sourceExpression)
        ? draft.sourceHex
        : encodeRuleData(parseRuleExpression(draft.expression)),
  };
}

export function importedRule(record: RuleRecord, name: string, sourceSection?: string): RuleDraft {
  let expression = '';
  let opaque = true;
  try {
    const ast = decodeRuleData(record.ruleDataHex);
    expression = renderRuleExpression(ast);
    opaque = !editableRuleExpression(ast);
  } catch {
    /* Keep unknown or unsupported firmware expressions byte-for-byte. */
  }
  return {
    id: randomUuid(),
    name,
    ruleId: record.ruleId,
    expression,
    trueEvent: record.trueEventId,
    falseEvent: record.falseEventId,
    debounce: record.debounceMilliseconds,
    activateDashboard: record.activateDashboard,
    sourceHex: record.ruleDataHex,
    sourceExpression: expression,
    opaque,
    ...(sourceSection ? { sourceSection } : {}),
  };
}

function hexNumber(value: string | undefined): number {
  if (!value || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error('INVALID_FIELD');
  }
  return Number.parseInt(value, 16);
}

function decimalNumber(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error('INVALID_FIELD');
  }
  return Number(value);
}

export function importRules(filename: string, original: string): RuleImport {
  const rules: RuleDraft[] = [];
  const parameters: RuleParameterName[] = [];
  const issues: string[] = [];
  if (/^\s*\[/m.test(original)) {
    const sections = [...original.matchAll(/^\[([^\]\r\n]+)\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)];
    const fields = (body: string) =>
      new Map(
        body.split(/\r?\n/).flatMap((line): [string, string][] => {
          const match = /^([^=]+)=(.*)$/.exec(line);
          return match?.[1] !== undefined && match[2] !== undefined
            ? [[match[1].trim().toUpperCase(), match[2].trim()]]
            : [];
        }),
      );
    for (const section of sections) {
      if (!/^PARAM\s/i.test(section[1] ?? '')) {
        continue;
      }
      const values = fields(section[2] ?? '');
      try {
        parameters.push({
          id: hexNumber(values.get('PARAMETER ID')),
          name: values.get('PARAMETER NAME') ?? '',
        });
      } catch {
        issues.push(`INVALID_PARAMETER: ${section[1] ?? ''}`);
      }
    }
    for (const section of sections) {
      if (!/^RULE\s/i.test(section[1] ?? '')) {
        continue;
      }
      const values = fields(section[2] ?? '');
      try {
        const rawDebounce = Number(values.get('DEBOUNCE TIME'));
        const record: RuleRecord = {
          ruleId: decimalNumber(values.get('RULE ID')),
          trueEventId: hexNumber(values.get('EVENT ID ON TRUE')),
          falseEventId: hexNumber(values.get('EVENT ID ON FALSE')),
          debounceMilliseconds: rawDebounce & 32767,
          activateDashboard: !!(rawDebounce & 32768),
          ruleDataHex: values.get('BINARY DATA') ?? '',
        };
        encodeRuleRecord(record);
        const draft = importedRule(
          record,
          values.get('RULE NAME') ?? `#${String(record.ruleId)}`,
          section[1],
        );
        rules.push(draft);
        const equation = values.get('RULE EQUATION');
        if (equation) {
          try {
            const ids = equation.replace(/\[([^\]]+)\]/g, (full: string, name: string) => {
              const matches = parameters.filter((parameter) => parameter.name === name);
              return matches.length === 1 ? `[${String(matches[0]?.id)}]` : full;
            });
            if (encodeRuleData(parseRuleExpression(ids)) !== record.ruleDataHex.toUpperCase()) {
              issues.push(`EQUATION_MISMATCH: ${section[1] ?? ''}`);
            }
          } catch {
            issues.push(`EQUATION_UNRESOLVED: ${section[1] ?? ''}`);
          }
        }
      } catch {
        issues.push(`INVALID_RULE: ${section[1] ?? ''}`);
      }
    }
  } else {
    for (const line of original.split(/\r?\n/)) {
      const packet = /(?:^|\s)(30,\d+,.*)$/.exec(line)?.[1];
      if (!packet) {
        continue;
      }
      const parts = packet.split(',');
      const payload = parts[9]?.trim().toUpperCase() ?? '';
      const opcode = payload.slice(0, 2);
      if (parts[5] !== '301' || (opcode !== '03' && opcode !== '04')) {
        issues.push(`INSPECTION_ONLY: ${parts[5] ?? ''}/${opcode || '—'}`);
        continue;
      }
      if (opcode === '03') {
        issues.push('REPLACE_ALL_RULES');
      }
      let offset = 2;
      while (offset < payload.length) {
        const length = Number.parseInt(payload.slice(offset + 16, offset + 18), 16);
        const end = offset + 18 + length * 2;
        try {
          const record = decodeRuleRecord(payload.slice(offset, end));
          rules.push(importedRule(record, `#${String(record.ruleId)}`));
        } catch {
          issues.push('INVALID_RULE_RECORD');
          break;
        }
        offset = end;
      }
    }
  }
  const seen = new Set<number>();
  for (const rule of rules) {
    if (rule.ruleId !== undefined) {
      if (seen.has(rule.ruleId)) {
        issues.push(`DUPLICATE_RULE_ID: ${String(rule.ruleId)}`);
      }
      seen.add(rule.ruleId);
    }
    if (rule.opaque) {
      issues.push(`OPAQUE_RULE: ${String(rule.ruleId)}`);
    }
    if (!rule.opaque) {
      for (const id of referencedParameterIds(parseRuleExpression(rule.expression))) {
        if (!parameters.some((parameter) => parameter.id === id)) {
          issues.push(`UNRESOLVED_PARAMETER: ${String(id)}`);
        }
      }
    }
  }
  return { filename, original, rules, parameters, issues: [...new Set(issues)] };
}

export function exportRulesIni(rules: readonly RuleDraft[], source: RuleImport | null): string {
  const sections = new Map<string, string>();
  for (const [index, rule] of rules.entries()) {
    const record = draftRecord(rule);
    const values = new Map<string, string>([
      ['RULE NAME', rule.name],
      ['RULE ID', String(record.ruleId)],
      ['EVENT ID ON TRUE', record.trueEventId.toString(16).toUpperCase()],
      ['EVENT ID ON FALSE', record.falseEventId.toString(16).toUpperCase()],
      [
        'DEBOUNCE TIME',
        String(record.debounceMilliseconds + (record.activateDashboard ? 32768 : 0)),
      ],
      ['BINARY DATA', record.ruleDataHex],
    ]);
    if (!rule.opaque) {
      values.set('RULE EQUATION', rule.expression);
      values.set(
        'RELETAED PARAMETERS',
        referencedParameterIds(parseRuleExpression(rule.expression))
          .map((id) => id.toString(16).toUpperCase())
          .join(','),
      );
    }
    const name = rule.sourceSection ?? `RULE HOLITA ${String(index + 1)}`;
    const originalBody =
      source?.original.match(
        new RegExp(
          `^\\[${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`,
          'm',
        ),
      )?.[1] ?? '';
    const lines = originalBody
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const key = line.split('=')[0]?.trim().toUpperCase();
        if (!key || !values.has(key)) {
          return line;
        }
        const value = values.get(key) ?? '';
        values.delete(key);
        return `${key}=${value}`;
      });
    for (const [key, value] of values) {
      lines.push(`${key}=${value}`);
    }
    sections.set(name, `[${name}]\n${lines.join('\n')}\n`);
  }
  const original = source?.original ?? '';
  const preserved = /^\s*\[/m.test(original)
    ? original.replace(
        /^\[([^\]\r\n]+)\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/gm,
        (block: string, name: string) => {
          const updated = sections.get(name);
          if (updated) {
            sections.delete(name);
            return `${updated}\n`;
          }
          return source?.rules.some((rule) => rule.sourceSection === name) ? '' : block;
        },
      )
    : '';
  return `; holita local export — ID expressions; Monitor compatibility is not certified.\n${preserved}\n${[...sections.values()].join('\n')}`;
}

function isDraft(value: unknown): value is RuleDraft {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'expression' in value &&
    typeof value.expression === 'string' &&
    'trueEvent' in value &&
    typeof value.trueEvent === 'number' &&
    'falseEvent' in value &&
    typeof value.falseEvent === 'number' &&
    'debounce' in value &&
    typeof value.debounce === 'number' &&
    (!('ruleId' in value) || typeof value.ruleId === 'number') &&
    (!('sourceHex' in value) || typeof value.sourceHex === 'string') &&
    (!('sourceExpression' in value) || typeof value.sourceExpression === 'string') &&
    (!('sourceSection' in value) || typeof value.sourceSection === 'string') &&
    (!('activateDashboard' in value) || typeof value.activateDashboard === 'boolean') &&
    (!('opaque' in value) || typeof value.opaque === 'boolean') &&
    (!('catalogVersion' in value) || typeof value.catalogVersion === 'string')
  );
}

interface SubmittedRule {
  readonly operationId: string;
  readonly target: string;
  readonly requestedAt: string;
  readonly definitionHex: string;
  readonly draft: RuleDraft;
}
interface RuleName {
  readonly target: string;
  readonly ruleId: number;
  readonly name: string;
}

function isSubmittedRule(value: unknown): value is SubmittedRule {
  return (
    !!value &&
    typeof value === 'object' &&
    'operationId' in value &&
    typeof value.operationId === 'string' &&
    'target' in value &&
    typeof value.target === 'string' &&
    'requestedAt' in value &&
    typeof value.requestedAt === 'string' &&
    'definitionHex' in value &&
    typeof value.definitionHex === 'string' &&
    'draft' in value &&
    isDraft(value.draft)
  );
}
function isRuleName(value: unknown): value is RuleName {
  return (
    !!value &&
    typeof value === 'object' &&
    'target' in value &&
    typeof value.target === 'string' &&
    'ruleId' in value &&
    typeof value.ruleId === 'number' &&
    'name' in value &&
    typeof value.name === 'string'
  );
}
function operationTarget(operation: DeviceConfigurationOperation): string {
  return JSON.stringify([operation.branchId, operation.karmaCarId, operation.karmaDeviceId]);
}

/** Local browser metadata, partitioned by verified session Tenant and Karma car. */
@Injectable()
export class RuleDraftStore {
  readonly rules = signal<RuleDraft[]>([]);
  readonly source = signal<RuleImport | null>(null);
  readonly archives = signal<{ filename: string; original: string }[]>([]);
  readonly storageError = signal(false);
  private key = '';
  private readonly submitted = signal<SubmittedRule[]>([]);
  private readonly names = signal<RuleName[]>([]);
  initialize(tenantId: string, carId: string): void {
    this.key = `holita.rules.v1:${tenantId}:${carId}`;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.key) ?? 'null');
      if (saved && typeof saved === 'object' && 'rules' in saved && Array.isArray(saved.rules)) {
        this.rules.set(saved.rules.filter(isDraft));
        if ('submitted' in saved && Array.isArray(saved.submitted)) {
          this.submitted.set(saved.submitted.filter(isSubmittedRule));
        }
        if ('names' in saved && Array.isArray(saved.names)) {
          this.names.set(saved.names.filter(isRuleName));
        }
        if ('archives' in saved && Array.isArray(saved.archives)) {
          this.archives.set(
            saved.archives.filter(
              (entry: unknown): entry is { filename: string; original: string } =>
                !!entry &&
                typeof entry === 'object' &&
                'filename' in entry &&
                typeof entry.filename === 'string' &&
                'original' in entry &&
                typeof entry.original === 'string',
            ),
          );
        }
        if (
          'filename' in saved &&
          typeof saved.filename === 'string' &&
          'original' in saved &&
          typeof saved.original === 'string'
        ) {
          this.source.set(importRules(saved.filename, saved.original));
        }
      }
    } catch {
      this.storageError.set(true);
    }
  }
  save(rule: RuleDraft): void {
    this.rules.update((rows) => [...rows.filter((row) => row.id !== rule.id), rule]);
    this.persist();
  }
  remove(id: string): void {
    this.rules.update((rows) => rows.filter((row) => row.id !== id));
    this.persist();
  }
  import(source: RuleImport): void {
    const previous = this.source();
    if (previous) {
      this.archives.update((items) => [
        ...items,
        { filename: previous.filename, original: previous.original },
      ]);
    }
    this.source.set(source);
    this.rules.update((rows) => [...rows, ...source.rules]);
    this.persist();
  }
  recordSubmission(
    draft: RuleDraft,
    operation: DeviceConfigurationOperation,
    definitionHex: string,
  ): void {
    this.submitted.update((rows) => [
      ...rows,
      {
        operationId: operation.id,
        target: operationTarget(operation),
        requestedAt: operation.requestedAt,
        definitionHex,
        draft,
      },
    ]);
    this.persist();
  }

  confirmedName(snapshot: DeviceConfigurationOperation, ruleId: number): string | undefined {
    const target = operationTarget(snapshot);
    return this.names().find((row) => row.target === target && row.ruleId === ruleId)?.name;
  }

  reconcile(snapshot: DeviceConfigurationOperation): void {
    if (snapshot.status !== 'COMPLETE' || !snapshot.rulesConfiguration) {
      return;
    }
    const target = operationTarget(snapshot);
    const confirmed = this.submitted().filter(
      (submission) =>
        submission.target === target &&
        snapshot.requestedAt >= submission.requestedAt &&
        snapshot.rulesConfiguration?.rules.some(
          (rule) =>
            rule.ruleId === submission.draft.ruleId &&
            rule.definitionHex === submission.definitionHex,
        ),
    );
    if (!confirmed.length) {
      return;
    }
    for (const submission of confirmed) {
      const draft = submission.draft;
      const ruleId = draft.ruleId;
      if (ruleId === undefined) {
        continue;
      }
      this.names.update((rows) => [
        ...rows.filter((row) => row.target !== target || row.ruleId !== ruleId),
        { target, ruleId, name: draft.name },
      ]);
      // Retire only the submitted local revision; a later edit remains a draft.
      this.rules.update((rows) =>
        rows.filter((row) => row.id !== draft.id || JSON.stringify(row) !== JSON.stringify(draft)),
      );
    }
    this.submitted.update((rows) => rows.filter((row) => !confirmed.includes(row)));
    this.persist();
  }

  private persist(): void {
    if (!this.key) {
      return;
    }
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({
          rules: this.rules(),
          submitted: this.submitted(),
          names: this.names(),
          archives: this.archives(),
          filename: this.source()?.filename,
          original: this.source()?.original,
        }),
      );
      this.storageError.set(false);
    } catch {
      this.storageError.set(true);
    }
  }
}
