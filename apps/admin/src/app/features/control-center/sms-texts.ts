/** Simple SMS commands of a StarLink unit (ERM protocol S0, S2, S11, S12, S13 and P593). */
export type SmsGroup = 'check' | 'route' | 'karma';
export type SmsTextId =
  | 'info'
  | 'loc'
  | 'getparam49'
  | 'getparam50'
  | 'getparam51'
  | 'getparam52'
  | 'route49'
  | 'route50'
  | 'karma49'
  | 'karma50';

export interface SmsText {
  readonly id: SmsTextId;
  readonly group: SmsGroup;
  readonly name: string;
  readonly text: string;
  /** An incoming Simple SMS may be at most 64 bytes (S13). */
  readonly bytes: number;
}

export const smsGroups: readonly SmsGroup[] = ['check', 'route', 'karma'];
export const smsMaxBytes = 64;

/** The ready-to-send texts in the order they are sent: `command#password[#parameters]`. */
export function smsTexts(password: string): readonly SmsText[] {
  const texts: readonly (readonly [SmsGroup, SmsTextId, string, string])[] = [
    ['check', 'info', 'info', `info#${password}`],
    ['check', 'loc', 'loc', `loc#${password}`],
    ['check', 'getparam49', 'getparam 0049', `getparam#${password}#49`],
    ['check', 'getparam50', 'getparam 0050', `getparam#${password}#50`],
    ['check', 'getparam51', 'getparam 0051', `getparam#${password}#51`],
    ['check', 'getparam52', 'getparam 0052', `getparam#${password}#52`],
    ['route', 'route49', 'setparam 0049', `setparam#${password}#49#65.108.137.165`],
    ['route', 'route50', 'setparam 0050', `setparam#${password}#50#11500`],
    ['karma', 'karma49', 'setparam 0049', `setparam#${password}#49#in.karma.online`],
    ['karma', 'karma50', 'setparam 0050', `setparam#${password}#50#500`],
  ];
  const encoder = new TextEncoder();
  return texts.map(([group, id, name, text]) => ({
    id,
    group,
    name,
    text,
    bytes: encoder.encode(text).length,
  }));
}
