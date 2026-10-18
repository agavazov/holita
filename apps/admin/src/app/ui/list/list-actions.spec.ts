import { type ListAction, listRecord, trackById } from './list-actions';

interface Row {
  readonly id: string;
  readonly plate: string;
  readonly active: boolean;
}

const actions: readonly ListAction<'edit' | 'deactivate' | 'delete', Row>[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'deactivate', label: 'Deactivate', bulk: true, appliesTo: (row) => row.active },
  { id: 'delete', label: 'Delete', bulk: true, danger: true },
];

describe('list actions', () => {
  it('records which actions do not apply to a row, from each action rule', () => {
    const active = { id: 'v1', plate: 'CB 1001 AX', active: true };
    const inactive = { id: 'v2', plate: 'CB 1002 AX', active: false };
    expect(listRecord(actions, active, active.id, active.plate)).toEqual({
      id: 'v1',
      label: 'CB 1001 AX',
      unavailable: [],
    });
    expect(listRecord(actions, inactive, inactive.id, inactive.plate).unavailable).toEqual([
      'deactivate',
    ]);
  });

  it('tracks table rows by ID', () => {
    expect(trackById(3, { id: 'v7' })).toBe('v7');
  });
});
