import { describe, expect, it } from 'vitest';
import { event } from '../../../test/graphql-fixture.js';
import { eventDraft, eventInput, validateEventDraft } from './event-form-state.js';

describe('Event form values', () => {
  it('preserves seconds and milliseconds when editing only the title of a short event', () => {
    const row = {
      ...event(),
      startsAt: '2026-10-25T00:30:10.123Z',
      endsAt: '2026-10-25T00:30:40.456Z',
      registrationOpensOn: null,
      registrationClosesOn: null,
    };
    const draft = { ...eventDraft(row), title: 'Updated' };
    expect(Object.values(validateEventDraft(draft, row)).filter(Boolean)).toEqual([]);
    expect(eventInput(draft, row)).toMatchObject({
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    });
  });
  it('preserves both autumn offsets and exact decimal strings on unrelated edits', () => {
    const row = {
      ...event(),
      startsAt: '2026-10-25T00:30:00.000Z',
      endsAt: '2026-10-25T01:30:00.000Z',
      registrationOpensOn: null,
      registrationClosesOn: null,
    };
    const draft = { ...eventDraft(row), title: ' Updated ' };
    expect(draft.startsAt).toBe(draft.endsAt);
    expect(Object.values(validateEventDraft(draft, row)).filter(Boolean)).toEqual([]);
    expect(eventInput(draft, row)).toMatchObject({
      title: 'Updated',
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      budget: '9999999999.99',
    });
  });
  it('rejects a nonexistent Sofia time and registration outside the event schedule', () => {
    const draft = {
      ...eventDraft(event()),
      startsAt: '2026-03-29T03:30',
      endsAt: '2026-03-29T05:00',
    };
    expect(validateEventDraft(draft).startsAt).toBe('Choose a valid date and time.');
    expect(validateEventDraft(draft).registrationClosesOn).toBe('Close by the event start date.');
    draft.startsAt = '2026-11-01T15:00';
    draft.endsAt = '2026-11-01T14:00';
    expect(validateEventDraft(draft).endsAt).toBe('End must be after start.');
    draft.registrationClosesOn = '';
    expect(validateEventDraft(draft).registrationClosesOn).toBe('Provide both registration dates.');
  });
  it('clears inapplicable relations and nullable fields without losing zero budget', () => {
    const draft = {
      ...eventDraft(event()),
      capacity: '',
      budget: '0',
      registrationOpensOn: '',
      registrationClosesOn: '',
      summary: ' ',
      venueId: 'previous-venue',
    };
    expect(eventInput(draft)).toMatchObject({
      budget: '0',
      capacity: null,
      venueId: null,
      registrationOpensOn: null,
      registrationClosesOn: null,
      summary: null,
    });
    expect(eventInput({ ...draft, format: 'IN_PERSON' }).meetingUrl).toBeNull();
    expect(validateEventDraft({ ...draft, budget: '0.001', capacity: '1.5' })).toMatchObject({
      budget: 'Use 0–9999999999.99, with at most two decimals.',
      capacity: 'Enter a positive whole number.',
    });
  });
});
