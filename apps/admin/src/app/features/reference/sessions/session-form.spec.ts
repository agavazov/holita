import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { eventRecord } from '../events/event-fixtures.spec-helper';
import { messages } from '../../../i18n/messages';
import { sessionRecord } from './session-fixtures.spec-helper';
import {
  sessionDraft,
  sessionInput,
  sessionFieldErrors,
  validateSessionDraft,
} from './session-form';
describe('Session typed inputs and Event bounds', () => {
  const event = eventRecord(),
    row = sessionRecord();
  it('defaults the start to the saved Event while retaining its precise instant', () => {
    const draft = sessionDraft(event);
    draft.title = '  Keynote  ';
    draft.endsAt = '2026-10-25T05:00';
    expect(validateSessionDraft(draft, event, messages.en)).toEqual({});
    expect(sessionInput(draft, event)).toMatchObject({
      title: 'Keynote',
      summary: null,
      room: null,
      startsAt: event.startsAt,
      speakerIds: [],
    });
  });
  it('preserves unchanged seconds, milliseconds and repeated autumn offsets', () => {
    for (const startsAt of ['2026-10-25T00:45:42.123Z', '2026-10-25T01:45:42.123Z']) {
      const parent = { ...event, startsAt: '2026-10-25T00:00:00Z' },
        session = { ...row, startsAt };
      expect(sessionInput(sessionDraft(parent, session), parent, session).startsAt).toBe(startsAt);
    }
  });
  it('rejects reversed and out-of-Event times, including seconds at the parent boundary', () => {
    const draft = sessionDraft(event, row);
    draft.startsAt = '2026-10-25T03:30';
    expect(validateSessionDraft(draft, event, messages.en, row).startsAt).toBe(
      messages.en.sessionWithinEvent,
    );
    draft.startsAt = '2026-10-25T05:00';
    draft.endsAt = '2026-10-25T04:00';
    expect(validateSessionDraft(draft, event, messages.en, row).endsAt).toBe(
      messages.en.eventEndError,
    );
    draft.endsAt = '2026-10-25T07:00';
    expect(validateSessionDraft(draft, event, messages.bg, row).endsAt).toBe(
      messages.bg.sessionWithinEvent,
    );
  });
  it('rejects spring gaps and invalid calendar values', () => {
    const parent = { ...event, startsAt: '2026-03-29T00:00:00Z', endsAt: '2026-03-29T06:00:00Z' },
      draft = sessionDraft(parent);
    draft.title = 'Keynote';
    draft.startsAt = '2026-03-29T03:30';
    draft.endsAt = '2026-03-29T06:00';
    expect(validateSessionDraft(draft, parent, messages.en).startsAt).toBe(
      messages.en.eventMissingTime,
    );
    draft.startsAt = '2026-02-30T12:00';
    expect(validateSessionDraft(draft, parent, messages.en).startsAt).toBe(
      messages.en.eventDateTimeError,
    );
  });
  it('validates trimmed Unicode text limits, NUL and the 100 distinct Speaker limit', () => {
    const draft = sessionDraft(event, row);
    for (const [field, max] of [
      ['title', 200],
      ['summary', 2000],
      ['room', 120],
    ] as const) {
      draft[field] = '😀'.repeat(max);
      expect(validateSessionDraft(draft, event, messages.en, row)[field]).toBeUndefined();
      draft[field] += 'x';
      expect(validateSessionDraft(draft, event, messages.en, row)[field]).toContain(String(max));
      draft[field] = 'ok';
    }
    draft.room = 'bad\0';
    expect(validateSessionDraft(draft, event, messages.en, row).room).toBe(
      messages.en.unsupportedCharacters,
    );
    draft.speakerIds = Array.from(
      { length: 101 },
      (_, i) => `50000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(validateSessionDraft(draft, event, messages.en, row).speakerIds).toBe(
      messages.en.sessionSpeakersLimit,
    );
    draft.speakerIds = [row.id, row.id];
    expect(validateSessionDraft(draft, event, messages.en, row).speakerIds).toBeTruthy();
  });
  it('clears optional values explicitly and copies Speaker IDs', () => {
    const draft = sessionDraft(event, row);
    draft.summary = ' ';
    draft.room = '';
    draft.speakerIds = [row.id];
    const input = sessionInput(draft, event, row);
    draft.speakerIds.splice(0);
    expect(input).toMatchObject({ summary: null, room: null, speakerIds: [row.id] });
  });
  it('accepts only concrete known server-field errors', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid',
          extensions: {
            fieldErrors: [
              { path: 'speakerIds', message: 'Choose active speakers' },
              { path: 'imaginary', message: 'Ignored' },
            ],
          },
        },
      ],
    });
    expect(sessionFieldErrors(error)).toEqual({ speakerIds: 'Choose active speakers' });
  });
});
