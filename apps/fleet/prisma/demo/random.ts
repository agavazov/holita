/** Independent seeded streams prevent changes in one vehicle/day from shifting other fixtures. */
export function rng(key: string): () => number {
  let state = 0x811c9dc5;
  for (const character of `holita:fleet-demo:v1:${key}`) {
    state = Math.imul(state ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const randomInt = (next: () => number, min: number, max: number): number =>
  min + Math.floor(next() * (max - min + 1));
