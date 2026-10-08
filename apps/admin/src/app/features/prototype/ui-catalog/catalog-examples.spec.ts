import { TestBed } from '@angular/core/testing';
import { FormExamples } from './form-examples/form-examples';
import { ListExamples } from './list-examples/list-examples';

function formPreview() {
  const fixture = TestBed.createComponent(FormExamples);
  fixture.componentRef.setInput('language', 'en');
  fixture.detectChanges();
  return fixture;
}

describe('Catalog typed form preview', () => {
  it('focuses the first invalid field and rejects blank names, invalid email and fractional quantities', () => {
    const fixture = formPreview();
    const form = fixture.componentInstance;
    form.save();
    expect(document.activeElement?.id).toBe('catalog-form-name');
    form.form.controls.name.setValue('   ');
    form.save();
    expect(document.activeElement?.id).toBe('catalog-form-name');
    form.form.controls.name.setValue('Local preview');
    form.form.controls.email.setValue('bad');
    form.save();
    expect(document.activeElement?.id).toBe('catalog-form-email');
    form.form.controls.email.setValue('preview@example.com');
    for (const quantity of [null, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      form.form.controls.quantity.setValue(quantity);
      form.save();
      expect(form.notice()).toBe(false);
      expect(document.activeElement?.id).toBe('catalog-quantity');
    }
    form.form.controls.quantity.setValue(3);
    form.save();
    expect(form.notice()).toBe(true);
  });
  it('preserves values in pending and failed previews and blocks submitted disabled forms', () => {
    const form = formPreview().componentInstance;
    form.form.patchValue({
      name: 'Draft',
      email: 'draft@example.com',
      labels: ['featured'],
      quantity: 3,
    });
    form.changeState('saving');
    expect(form.form.disabled).toBe(true);
    form.save();
    expect(form.notice()).toBe(false);
    form.changeState('error');
    expect(form.form.enabled).toBe(true);
    expect(form.form.getRawValue()).toMatchObject({
      name: 'Draft',
      quantity: 3,
      labels: ['featured'],
    });
    form.save();
    expect(form.state()).toBe('ready');
    expect(form.notice()).toBe(true);
    form.changeState('disabled');
    form.save();
    expect(form.notice()).toBe(false);
  });
  it('resets every typed control to its initial example value', () => {
    const form = formPreview().componentInstance;
    form.form.patchValue({
      name: 'Draft',
      active: false,
      labels: ['new'],
      date: new Date(),
      delivery: 'shipping',
    });
    form.reset();
    expect(form.form.getRawValue()).toMatchObject({
      name: '',
      active: true,
      labels: [],
      date: null,
      quantity: 1,
      delivery: 'pickup',
    });
    expect(form.form.pristine).toBe(true);
  });
});

describe('Catalog local list preview', () => {
  function listPreview() {
    const fixture = TestBed.createComponent(ListExamples);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  it('keeps selection page-local and clears it on paging, filters and sorting', () => {
    const list = listPreview();
    list.selectRows([...list.page(), { id: '012' }, { id: 'invalid' }]);
    expect(list.selected()).toHaveLength(5);
    list.changePage({ first: 5, rows: 5 });
    expect(list.selected()).toHaveLength(0);
    expect(list.page()[0]?.name).toBe('Canvas pouch');
    list.selectRows(list.page());
    list.changeSearch(' Linen ');
    expect(list.first()).toBe(0);
    expect(list.selected()).toHaveLength(0);
    expect(list.page()).toHaveLength(1);
    list.changeStatus('active');
    expect(list.page()).toHaveLength(0);
    list.clearFilters();
    list.selectRows(list.page());
    list.sortChanged({ field: 'active', order: -1 });
    expect(list.selected()).toHaveLength(0);
    expect(list.page().every((row) => row.active)).toBe(true);
  });
  it('requires explicit confirmation, corrects the last page and keeps edits local', () => {
    const list = listPreview();
    list.changePage({ first: 10, rows: 5 });
    list.openDelete(list.page());
    list.dialog.set(null);
    expect(list.rows()).toHaveLength(12);
    list.openDelete(list.page());
    list.deleteExamples();
    expect(list.rows()).toHaveLength(10);
    expect(list.first()).toBe(5);
    const row = list.page()[0];
    if (!row) throw new Error('Missing example.');
    list.openDialog('edit', row);
    list.form.controls.name.setValue('Edited example');
    list.save();
    expect(list.rows().find((item) => item.id === row.id)?.name).toBe('Edited example');
    list.openDialog('create', null);
    list.form.controls.name.setValue('Created example');
    list.save();
    expect(list.rows()).toHaveLength(11);
  });
});
