import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { FormField, type FieldCounter } from './form-field';

@Component({
  imports: [FormField],
  template: `
    <holita-form-field
      label="Бележки"
      controlId="vehicle-notes"
      hint="До 2000 знака"
      [error]="error()"
      [required]="true"
      [counter]="counter()"
    >
      <textarea
        id="vehicle-notes"
        [attr.aria-describedby]="'vehicle-notes-hint vehicle-notes-error'"
        [attr.aria-invalid]="error() ? 'true' : null"
      ></textarea>
    </holita-form-field>
  `,
})
class Host {
  readonly error = signal<string | null>(null);
  readonly counter = signal<FieldCounter | null>({ length: 1234, max: 2000 });
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) throw new Error('Missing host element.');
  return value;
}

describe('FormField', () => {
  it('wires label, hint, error and counter to the projected control', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = element(fixture);
    const label = root.querySelector('label');
    expect(label?.getAttribute('for')).toBe('vehicle-notes');
    expect(label?.textContent).toContain('Бележки');
    expect(label?.querySelector('.app-visually-hidden')?.textContent).toBe('(задължително)');
    expect(root.querySelector('#vehicle-notes-hint')?.textContent).toBe('До 2000 знака');
    const counter = root.querySelector('.form-field__counter');
    expect(counter?.textContent.trim()).toBe('1 234 / 2 000');
    expect(counter?.classList.contains('form-field__counter--warn')).toBe(false);
    expect(root.querySelector('#vehicle-notes-error')?.textContent.trim()).toBe('');
    fixture.componentInstance.counter.set({ length: 1801, max: 2000 });
    fixture.componentInstance.error.set('Използвайте най-много 2000 знака.');
    fixture.detectChanges();
    expect(root.querySelector('.form-field__counter--warn')).not.toBeNull();
    expect(root.querySelector('#vehicle-notes-error')?.textContent).toContain('2000 знака');
    expect(root.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
  });
});
