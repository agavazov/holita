import { createPrototypeState, prototypeStorageKey } from './state';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
class MemoryStorage {
  value: string | null = null;
  failWrites = false;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    if (this.failWrites) throw new Error('Full');
    this.value = value;
  }
}
describe('Prototype Vehicles', () => {
  it('persists scoped CRUD, preserves multiline notes and clears them with null', () => {
    const storage = new MemoryStorage();
    const state = createPrototypeState(storage);
    const vehicle = state.createVehicle(storeA, {
      licensePlate: ' CA1234AB ',
      notes: ' First\nSecond ',
    });
    expect(vehicle).toMatchObject({ licensePlate: 'CA1234AB', notes: 'First\nSecond' });
    expect(state.listVehicles(storeB, { offset: 0, limit: 20 }).total).toBe(0);
    for (const action of [
      () => state.getVehicle(storeB, vehicle.id),
      () => state.updateVehicle(storeB, vehicle.id, { notes: 'Wrong' }),
      () => state.deleteVehicle(storeB, vehicle.id),
    ])
      expect(action).toThrow('Vehicle not found');
    const reloaded = createPrototypeState(storage);
    expect(reloaded.getVehicle(storeA, vehicle.id)).toEqual(vehicle);
    expect(
      reloaded.updateVehicle(storeA, vehicle.id, { licensePlate: ' CB5678AB ', notes: null }),
    ).toMatchObject({ licensePlate: 'CB5678AB', notes: null });
    reloaded.deleteVehicle(storeA, vehicle.id);
    expect(createPrototypeState(storage).listVehicles(storeA, { offset: 0, limit: 20 }).total).toBe(
      0,
    );
  });
  it('sorts and pages case-insensitive literal plate searches', () => {
    const state = createPrototypeState(new MemoryStorage());
    for (const licensePlate of ['CA3000AB', 'CA100%_AB', 'CA2000AB'])
      state.createVehicle(storeA, { licensePlate });
    const variables = {
      offset: 1,
      limit: 1,
      search: 'ca',
      sort: { field: 'LICENSE_PLATE', direction: 'ASC' },
    } as const;
    expect(state.listVehicles(storeA, variables)).toMatchObject({
      total: 3,
      items: [{ licensePlate: 'CA2000AB' }],
    });
    expect(state.listVehicles(storeA, { offset: 0, limit: 20, search: '%_' }).items).toHaveLength(
      1,
    );
  });
  it('keeps saved data unchanged on validation and storage failures', () => {
    const storage = new MemoryStorage();
    const state = createPrototypeState(storage);
    const vehicle = state.createVehicle(storeA, { licensePlate: 'CA1234AB' });
    const saved = storage.value;
    expect(() => state.createVehicle(storeA, { licensePlate: ' ' })).toThrow();
    expect(() => state.updateVehicle(storeA, vehicle.id, { notes: 'x'.repeat(2001) })).toThrow();
    expect(() => state.updateVehicle(storeA, vehicle.id, {})).toThrow();
    storage.failWrites = true;
    expect(() => state.deleteVehicle(storeA, vehicle.id)).toThrow('could not be saved');
    expect(storage.value).toBe(saved);
  });
  it('upgrades version 2 snapshots without discarding existing records and exposes migration write failures', () => {
    const storage = new MemoryStorage();
    const state = createPrototypeState(storage);
    const existing = state.listProducts(storeA, { offset: 0, limit: 20 });
    if (!storage.value) throw new Error('Missing snapshot');
    const old: unknown = JSON.parse(storage.value);
    if (typeof old !== 'object' || old === null) throw new Error('Invalid snapshot');
    Reflect.deleteProperty(old, 'vehicles');
    Reflect.set(old, 'version', 2);
    const legacy = JSON.stringify(old);
    storage.setItem(prototypeStorageKey, legacy);
    const upgraded = createPrototypeState(storage);
    expect(upgraded.listProducts(storeA, { offset: 0, limit: 20 })).toEqual(existing);
    expect(upgraded.listVehicles(storeA, { offset: 0, limit: 20 }).total).toBe(0);
    expect(storage.value).toContain('"version":3');
    storage.value = legacy;
    storage.failWrites = true;
    expect(() => createPrototypeState(storage)).toThrow('could not be saved');
    expect(storage.value).toBe(legacy);
  });
});
