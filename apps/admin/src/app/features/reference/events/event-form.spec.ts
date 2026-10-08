import { convertToParamMap } from '@angular/router';
import { messages } from '../../../i18n/messages';
import { eventRecord } from './event-fixtures.spec-helper';
import { eventDraft, eventInput, eventUpdateInput, validateEventDraft } from './event-form';
import { eventInputInstant, formatEventTime, formatEventCalendarDate } from './event-time';
import {
  readEventListQuery,
  eventListVariables,
  eventListQueryParams,
  readEventColumns,
} from './event-list-query';
import {
  descriptionBytes,
  descriptionMaxBytes,
  safeDescriptionHtml,
  isDescriptionLink,
} from './description-html';

describe('Event form contracts', () => {
  it('formats Sofia instants in the selected language and keeps registration calendar dates unchanged', () => {
    expect(formatEventTime('2026-07-01T09:30:00Z', 'bg')).toContain('01.07.2026');
    expect(formatEventTime('2026-07-01T09:30:00Z', 'en')).toBe('01/07/2026, 12:30');
    expect(formatEventCalendarDate('2026-07-01', 'bg')).toContain('01.07.2026');
    expect(formatEventCalendarDate('2026-07-01', 'en')).toBe('01/07/2026');
  });
  it('preserves seconds and milliseconds in either repeated autumn hour and recalculates changed dates', () => {
    for (const instant of ['2026-10-25T00:30:42.123Z', '2026-10-25T01:30:42.123Z'])
      expect(eventInputInstant('2026-10-25T03:30', instant)).toBe(instant);
    expect(eventInputInstant('2026-07-01T12:30', '2026-12-01T10:30:00Z')).toBe(
      '2026-07-01T09:30:00.000Z',
    );
    expect(eventInputInstant('2026-12-01T12:30')).toBe('2026-12-01T10:30:00.000Z');
  });
  it('rejects spring gaps and invalid dates, and reports errors in Bulgarian', () => {
    const values = eventDraft(eventRecord());
    values.startsAt = '2026-03-29T03:30';
    expect(validateEventDraft(values, messages.en).startsAt).toContain('does not exist');
    expect(validateEventDraft(values, messages.bg).startsAt).toContain('не съществува');
    for (const value of ['2026-02-30T12:30', '2026-13-01T12:30', '2026-01-01T25:00', ''])
      expect(() => eventInputInstant(value)).toThrow();
  });
  it('keeps exact maximum EUR decimals as strings and omits immutable code from updates', () => {
    const row = eventRecord(),
      values = eventDraft(row),
      input = eventInput(values, row);
    expect(input.budget).toBe('9999999999.99');
    expect(input.startsAt).toBe(row.startsAt);
    expect(eventUpdateInput(values, row)).not.toHaveProperty('code');
    for (const budget of ['1e2', '0.001', '01.00', '10000000000', '-1', '1,20'])
      expect(validateEventDraft({ ...values, budget }, messages.en).budget).toBeTruthy();
    for (const budget of ['0', '0.1', '12.34', '9999999999.99'])
      expect(validateEventDraft({ ...values, budget }, messages.en).budget).toBeUndefined();
  });
  it('maps explicit clearing and false, clears format-inapplicable fields and validates venue/URL requirements', () => {
    const row = eventRecord(),
      values = eventDraft(row);
    expect(
      eventInput(
        {
          ...values,
          capacity: '',
          budget: '',
          summary: ' ',
          descriptionHtml: '',
          featured: false,
          tagIds: [],
        },
        row,
      ),
    ).toMatchObject({
      capacity: null,
      budget: null,
      summary: null,
      descriptionHtml: null,
      featured: false,
      tagIds: [],
      venueId: null,
    });
    expect(
      validateEventDraft({ ...values, format: 'HYBRID', venueId: '' }, messages.en).venueId,
    ).toBeTruthy();
    expect(
      validateEventDraft({ ...values, format: 'ONLINE', meetingUrl: 'file:///bad' }, messages.en)
        .meetingUrl,
    ).toBeTruthy();
    expect(
      eventInput(
        { ...values, format: 'IN_PERSON', venueId: '30000000-0000-4000-8000-000000000001' },
        row,
      ).meetingUrl,
    ).toBeNull();
  });
  it('validates schedule order, paired dates and registration by the Sofia event date', () => {
    const values = eventDraft(eventRecord());
    expect(
      validateEventDraft({ ...values, endsAt: values.startsAt }, messages.en).endsAt,
    ).toBeTruthy();
    expect(
      validateEventDraft({ ...values, registrationOpensOn: '2026-10-01' }, messages.en)
        .registrationClosesOn,
    ).toBeTruthy();
    expect(
      validateEventDraft(
        { ...values, registrationOpensOn: '2026-10-20', registrationClosesOn: '2026-10-19' },
        messages.en,
      ).registrationClosesOn,
    ).toBeTruthy();
    expect(
      validateEventDraft(
        { ...values, registrationOpensOn: '2026-10-20', registrationClosesOn: '2026-10-26' },
        messages.en,
      ).registrationClosesOn,
    ).toBeTruthy();
  });
  it('uses Unicode code points, rejects NUL, validates Int capacity and enforces UTF-8 bytes', () => {
    const values = eventDraft(eventRecord());
    expect(
      validateEventDraft({ ...values, title: '😀'.repeat(200) }, messages.en).title,
    ).toBeUndefined();
    expect(
      validateEventDraft({ ...values, title: '😀'.repeat(201) }, messages.en).title,
    ).toBeTruthy();
    expect(validateEventDraft({ ...values, summary: 'bad\0' }, messages.en).summary).toBeTruthy();
    for (const capacity of ['0', '1.2', '1e2', '2147483648'])
      expect(validateEventDraft({ ...values, capacity }, messages.en).capacity).toBeTruthy();
    const html = 'я'.repeat(51200);
    expect(descriptionBytes(html)).toBe(descriptionMaxBytes);
    expect(
      validateEventDraft({ ...values, descriptionHtml: html }, messages.en).descriptionHtml,
    ).toBeUndefined();
    expect(
      validateEventDraft({ ...values, descriptionHtml: html + 'я' }, messages.en).descriptionHtml,
    ).toBeTruthy();
  });
});
describe('Event URL and calendar filters', () => {
  it('round-trips Trash without changing the retained status filters and defaults unknown views to Active', () => {
    const state = readEventListQuery(
      convertToParamMap({ view: 'trash', status: 'PUBLISHED', page: '2' }),
    );
    expect(eventListQueryParams(state)).toMatchObject({
      view: 'trash',
      status: 'PUBLISHED',
      page: '2',
    });
    expect(eventListVariables(state)).toMatchObject({
      filter: { trashed: true, statuses: ['PUBLISHED'] },
      offset: 20,
    });
    expect(readEventListQuery(convertToParamMap({ view: 'unknown' })).trashed).toBe(false);
  });
  it('round-trips every filter, sorting and paging', () => {
    const params = {
      search: 'Forum',
      status: 'DRAFT,PUBLISHED',
      format: 'ONLINE,HYBRID',
      venues: '30000000-0000-4000-8000-000000000001',
      tags: '40000000-0000-4000-8000-000000000001',
      featured: 'false',
      from: '2026-10-01',
      to: '2026-10-31',
      min: '1',
      max: '100',
      sort: 'budget',
      order: 'desc',
      page: '2',
      pageSize: '10',
    };
    const state = readEventListQuery(convertToParamMap(params));
    expect(readEventListQuery(convertToParamMap(eventListQueryParams(state)))).toEqual(state);
    expect(eventListVariables(state)).toMatchObject({
      offset: 10,
      limit: 10,
      sort: { field: 'BUDGET', direction: 'DESC' },
      filter: {
        capacityMin: 1,
        capacityMax: 100,
        featured: false,
        statuses: ['DRAFT', 'PUBLISHED'],
      },
    });
  });
  it('bounds untrusted URL values and retains generated defaults', () => {
    const state = readEventListQuery(
      convertToParamMap({
        page: '99999999999999',
        pageSize: '100',
        sort: 'invalid',
        order: 'bad',
        status: 'INVALID',
        venues: 'bad',
        min: '100',
        max: '1',
        from: '2026-02-30',
        to: 'bad',
        search: 'x\0',
      }),
    );
    expect(state).toMatchObject({
      sort: 'STARTS_AT',
      order: 'ASC',
      statuses: [],
      venueIds: [],
      capacityMax: '',
      from: '',
      to: '',
      search: 'x',
    });
    expect(eventListVariables(state).offset).toBeLessThanOrEqual(2147483647);
    expect(readEventListQuery(convertToParamMap({ page: '-1', pageSize: '200' }))).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });
  it('retains a valid maximum when the URL minimum is invalid', () => {
    const state = readEventListQuery(convertToParamMap({ min: '9999999999', max: '100' }));
    expect(state.capacityMin).toBe('');
    expect(state.capacityMax).toBe('100');
    expect(eventListVariables(state).filter).toEqual({ capacityMax: 100 });
  });
  it.each([
    ['2026-03-29', '2026-03-28T22:00:00.000Z', '2026-03-29T21:00:00.000Z'],
    ['2026-10-25', '2026-10-24T21:00:00.000Z', '2026-10-25T22:00:00.000Z'],
  ])('resolves the complete DST calendar day %s', (date, from, before) => {
    expect(
      eventListVariables(readEventListQuery(convertToParamMap({ from: date, to: date }))).filter,
    ).toEqual({ startsAtFrom: from, startsAtBefore: before });
  });
  it('accepts only supported column preferences and recovers malformed storage', () => {
    expect(readEventColumns('["budget","bad","code","budget"]')).toEqual(['code', 'budget']);
    expect(readEventColumns('bad')).toContain('startsAt');
    expect(readEventColumns('[]')).toEqual([]);
  });
});
describe('Description browser boundary', () => {
  it('preserves supported formatting and strips scripts, media, attributes and unsafe links', () => {
    const html = safeDescriptionHtml(
      '<h2 style="color:red">Title</h2><p><b>Bold</b><i>Italic</i><img src=x onerror=alert(1)><script>alert(1)</script><a href="https://u:p@example.com">private</a><a href="//example.com">relative</a><a href="javascript:alert(1)">bad</a><a href="https://example.com" target="_blank">safe</a></p>',
    );
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).not.toMatch(/script|style|img|onerror|javascript|u:p|target=/);
    expect(html).toContain('<a href="https://example.com">safe</a>');
    expect(safeDescriptionHtml(html)).toBe(html);
  });
  it.each(['https://example.com', 'http://example.com/x'])('accepts %s', (link) => {
    expect(isDescriptionLink(link)).toBe(true);
  });
  it.each([
    '//example.com',
    'https://u:p@example.com',
    '/local',
    'mailto:a@example.com',
    'javascript:alert(1)',
  ])('rejects %s', (link) => {
    expect(isDescriptionLink(link)).toBe(false);
  });
});
