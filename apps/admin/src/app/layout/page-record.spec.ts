import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectPageRecord, PageRecord } from './page-record';

@Component({ selector: 'holita-test-record-page', template: '' })
class RecordPage {
  readonly name = signal<string | null>('CB 1001 AX');

  constructor() {
    injectPageRecord(() => this.name());
  }
}

describe('PageRecord', () => {
  it('shows the latest registration until that one is cleared', () => {
    const record = TestBed.inject(PageRecord);
    const unregister = record.register(signal('A'));
    expect(record.label()).toBe('A');
    unregister();
    expect(record.label()).toBeNull();

    // A page leaving after the next one registered keeps the next one's record.
    const leaving = record.register(signal('A'));
    record.register(signal('B'));
    leaving();
    expect(record.label()).toBe('B');
  });

  it("follows a page's record name while the page is shown", () => {
    const fixture = TestBed.createComponent(RecordPage);
    const record = TestBed.inject(PageRecord);
    expect(record.label()).toBe('CB 1001 AX');
    fixture.componentInstance.name.set('CB 1002 AX');
    expect(record.label()).toBe('CB 1002 AX');
    fixture.destroy();
    expect(record.label()).toBeNull();
  });
});
