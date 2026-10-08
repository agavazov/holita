import { SubmittedWrites } from './submitted-writes';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProductsApi } from '../../features/products/products-api';

describe('submitted writes and Prototype Reset', () => {
  it('drains all submitted writes, rejects new ones during Reset and resumes after failure', async () => {
    const writes = new SubmittedWrites();
    const a = writes.begin(),
      b = writes.begin();
    let drained = false;
    const pending = writes.pauseAndDrain().then(() => {
      drained = true;
    });
    expect(() => writes.begin()).toThrow('Reset');
    a();
    a();
    await Promise.resolve();
    expect(drained).toBe(false);
    b();
    await pending;
    expect(drained).toBe(true);
    writes.resume();
    const next = writes.begin();
    next();
    await writes.pauseAndDrain();
  });

  it('waits for real Apollo submissions from retired store clients, including rejected writes', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const a = TestBed.runInInjectionContext(() => new ProductsApi());
    const b = TestBed.runInInjectionContext(() => new ProductsApi());
    a.initialize('10000000-0000-4000-8000-000000000001', 'en');
    b.initialize('10000000-0000-4000-8000-000000000002', 'bg');
    const created = a.create({ input: { name: 'Submitted A', sku: 'A' } });
    const failed = b
      .create({ input: { name: 'Submitted B', sku: 'B' } })
      .catch((error: unknown) => error);
    const requests = http.match('/graphql');
    expect(requests).toHaveLength(2);
    a.ngOnDestroy();
    b.ngOnDestroy();
    let drained = false;
    const idle = TestBed.inject(SubmittedWrites)
      .pauseAndDrain()
      .then(() => {
        drained = true;
      });
    requests[0]?.flush({
      data: {
        createProduct: {
          id: '20000000-0000-4000-8000-000000000099',
          storeId: '10000000-0000-4000-8000-000000000001',
          name: 'Submitted A',
          sku: 'A',
          status: 'DRAFT',
        },
      },
    });
    await created;
    expect(drained).toBe(false);
    requests[1]?.flush({ errors: [{ message: 'Storage rejected' }] });
    expect(await failed).toHaveProperty('message', 'Storage rejected');
    await idle;
    expect(drained).toBe(true);
    http.verify();
  });
});
