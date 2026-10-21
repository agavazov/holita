import { convertToParamMap } from '@angular/router';
import {
  karmaCarListContext,
  karmaCarNavigationContext,
  karmaCarReturnQuery,
} from './karma-car-context';

describe('Karma truck list return context', () => {
  it('roundtrips applied list filters/page and omits defaults', () => {
    const context = karmaCarListContext(
      convertToParamMap({ q: '  TEST  ', size: '25', first: '50', project: '12' }),
    );
    expect(context).toEqual({ listQ: 'TEST', listSize: 25, listFirst: 50, listProject: '12' });
    expect(karmaCarReturnQuery(convertToParamMap(context))).toEqual({
      q: 'TEST',
      size: 25,
      first: 50,
      project: '12',
    });
    expect(karmaCarListContext(convertToParamMap({}))).toEqual({});
    expect(karmaCarReturnQuery(convertToParamMap({}))).toEqual({});
  });
  it('keeps truck-list context alone when changing sections', () => {
    expect(
      karmaCarNavigationContext(
        convertToParamMap({
          listQ: 'TEST',
          listSize: '100',
          listFirst: '200',
          listProject: '12',
          from: '2026-01-01T00:00:00',
          to: '2026-01-02T00:00:00',
          size: '25',
          cursor: 'history-cursor',
          trip: '4000000001',
          returnTo: 'https://other.example/',
        }),
      ),
    ).toEqual({ listQ: 'TEST', listSize: 100, listFirst: 200, listProject: '12' });
  });
  it('bounds search and drops duplicate, misaligned and invalid values', () => {
    expect(
      karmaCarReturnQuery(
        convertToParamMap({
          listQ: '🙂'.repeat(250),
          listSize: '7',
          listFirst: '7',
          listProject: '-1',
        }),
      ),
    ).toEqual({ q: '🙂'.repeat(200) });
    expect(
      karmaCarReturnQuery(
        convertToParamMap({
          listQ: ['a', 'b'],
          listSize: ['25', '100'],
          listFirst: '9007199254740992',
          listProject: ['12', '13'],
        }),
      ),
    ).toEqual({});
    expect(karmaCarReturnQuery(convertToParamMap({ listProject: '0' }))).toEqual({});
  });
});
