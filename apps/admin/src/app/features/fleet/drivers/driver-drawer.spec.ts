import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DriverDrawer, type DriverForm } from './driver-drawer';

describe('DriverDrawer contract fields', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(DriverDrawer);
    fixture.componentRef.setInput('businessDate', '2026-10-18');
    const saved: DriverForm[] = [];
    fixture.componentInstance.save.subscribe((form) => saved.push(form));
    fixture.detectChanges();
    await fixture.whenStable();
    const form = document.getElementById('driver-form');
    if (!form) {
      throw new Error('Missing driver form.');
    }
    const fill = (field: string, value: string) => {
      const input = document.getElementById(`driver-${field}`);
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing ${field}.`);
      }
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: value.at(-1) ?? 'Backspace', bubbles: true }),
      );
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input;
    };
    const submit = async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { saved, fill, submit };
  }

  it('requires each name while accepting no employee number, documents or categories', async () => {
    const { saved, fill, submit } = await render();
    fill('firstName', ' Avery ');
    await submit();
    expect(saved).toHaveLength(0);
    fill('lastName', ' Driver ');
    await submit();
    expect(saved[0]).toMatchObject({
      firstName: 'Avery',
      lastName: 'Driver',
      employeeNo: '',
      identificationKey: '',
      licenseNumber: '',
      licenseCategories: [],
      licenseExpiresOn: null,
      tachographCardNumber: '',
      tachoCardExpiresOn: null,
    });
  });

  it('uses the backend text limits and accepts a 16-character tachograph card number', async () => {
    const { saved, fill, submit } = await render();
    fill('firstName', 'Avery');
    fill('lastName', 'Driver');
    const card = fill('tachographCardNumber', '12345678901234567');
    await submit();
    expect(saved).toHaveLength(0);
    expect(card.getAttribute('aria-invalid')).toBe('true');
    expect(card).toBe(document.activeElement);
    fill('tachographCardNumber', '1234567890123456');
    fill('identificationKey', 'identity-01');
    fill('licenseNumber', 'license-01');
    await submit();
    expect(saved[0]).toMatchObject({
      tachographCardNumber: '1234567890123456',
      identificationKey: 'identity-01',
      licenseNumber: 'license-01',
    });
  });

  it('keeps optional document dates within the backend calendar range', async () => {
    const { saved, fill, submit } = await render();
    fill('firstName', 'Avery');
    fill('lastName', 'Driver');
    const licence = fill('licenseExpiresOn', '1899-12-31');
    const card = fill('tachoCardExpiresOn', '2101-01-01');
    await submit();
    expect(saved).toHaveLength(0);
    expect(licence.getAttribute('aria-invalid')).toBe('true');
    expect(card.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(licence);
    fill('licenseExpiresOn', '1900-01-01');
    fill('tachoCardExpiresOn', '2100-12-31');
    await submit();
    expect(saved[0]).toMatchObject({
      licenseExpiresOn: '1900-01-01',
      tachoCardExpiresOn: '2100-12-31',
    });
  });
});
