import { Injectable, signal } from '@angular/core';
import type { Language } from '../../../i18n/messages';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import bg from './diagnostic-attention.bg.json';
import en from './diagnostic-attention.en.json';

export type DiagnosticReviewStatus = 'UNREVIEWED' | 'REVIEWED' | 'ACKNOWLEDGED';
export type DiagnosticReviewKind = 'fault' | 'risk';
export const attentionText: Record<Language, typeof en> = { bg, en };
export const localReviewField: FilterField = {
  key: 'localReview',
  label: '',
  type: 'enum',
  operators: ['isAnyOf'],
  options: ['UNREVIEWED', 'REVIEWED', 'ACKNOWLEDGED'].map((value) => ({ value, label: value })),
};
export function reviewField(language: Language): FilterField {
  const text = attentionText[language];
  return {
    ...localReviewField,
    label: text.localReview,
    options: Object.entries(text.statuses).map(([value, label]) => ({ value, label })),
  };
}

@Injectable()
export class DiagnosticsReview {
  private readonly records = signal<ReadonlyMap<string, DiagnosticReviewStatus>>(new Map());

  status(kind: DiagnosticReviewKind, id: string): DiagnosticReviewStatus {
    return this.records().get(`${kind}/${id}`) ?? 'UNREVIEWED';
  }
  set(kind: DiagnosticReviewKind, id: string, status: DiagnosticReviewStatus): void {
    const records = new Map(this.records());
    if (status === 'UNREVIEWED') {
      records.delete(`${kind}/${id}`);
    } else {
      records.set(`${kind}/${id}`, status);
    }
    this.records.set(records);
  }
  matches(kind: DiagnosticReviewKind, id: string, conditions: readonly FilterCondition[]): boolean {
    return conditions
      .filter((condition) => condition.field === 'localReview')
      .every((condition) => condition.values.includes(this.status(kind, id)));
  }
  reset(): void {
    this.records.set(new Map());
  }
}
