export const DEMO_TENANT_ID = '01000000-0000-4000-8000-000000000001';
export const DEMO_BRANCH_ID = '10000000-0000-4000-8000-000000000001';
export const DEMO_SCOPE = { tenantId: DEMO_TENANT_ID, branchId: DEMO_BRANCH_ID };
export const workshopVehicles = [5, 22, 24, 30];
export const inactiveVehicles = [20, 36, 41];
export const withoutDevice = [19, 24, 36, 41];
export const movingVehicles = [2, 3, 4, 6, 9, 10, 11, 12, 27, 28, 31];
export const idleVehicles = [13, 21, 29, 38, 40];

/** Current assignments intentionally include one relay driver on two trucks. */
export function driverNumber(vehicle: number): number | null {
  if (vehicle <= 18) {
    return vehicle;
  }
  const assignments: Readonly<Record<number, number>> = {
    21: 19,
    23: 20,
    25: 21,
    26: 14,
    27: 22,
    28: 23,
    29: 24,
    30: 25,
    31: 26,
    33: 27,
    38: 28,
  };
  return assignments[vehicle] ?? null;
}

export const firstNames = [
  'Георги',
  'Георги',
  'Александра-Мария',
  'Иван',
  'Петър',
  'Николай',
  'Димитър',
  'Мартин',
  'Елена',
  'Виктор',
  'Теодора',
  'Стефан',
  'Борис',
  'Кирил',
  'Десислава',
  'Антон',
  'Христо',
  'Надежда',
];
export const lastNames = [
  'Иванов',
  'Иванов',
  'Константинова-Христозова',
  'Петров',
  'Димитров',
  'Георгиев',
  'Стоянов',
  'Колев',
  'Петрова',
  'Николов',
  'Маринова',
  'Попов',
  'Тодоров',
  'Василев',
  'Ангелова',
  'Атанасов',
];
export const places = [
  { address: 'София, база Божурище', latitude: 42.765, longitude: 23.191 },
  { address: 'Пловдив, индустриална зона', latitude: 42.145, longitude: 24.749 },
  { address: 'Варна, логистична база', latitude: 43.215, longitude: 27.912 },
  { address: 'Букурещ, демонстрационен склад', latitude: 44.435, longitude: 26.103 },
  { address: 'Кулата, демонстрационен терминал', latitude: 41.389, longitude: 23.362 },
] as const;

export const tractorModels = [
  ['Mercedes-Benz', 'Actros 1845'],
  ['DAF', 'XF 480'],
  ['Volvo', 'FH 500'],
  ['Scania', 'R 450'],
  ['MAN', 'TGX 18.510'],
] as const;
export const rigidModels = [
  ['Mercedes-Benz', 'Atego 1530'],
  ['DAF', 'LF 290'],
  ['MAN', 'TGL 12.250'],
  ['Iveco', 'Eurocargo 120'],
] as const;
export const vanModels = [
  ['Mercedes-Benz', 'Sprinter 316'],
  ['Ford', 'Transit 350'],
  ['Iveco', 'Daily 35S16'],
  ['Renault', 'Master 2.3'],
] as const;
export const carModels = [
  ['Škoda', 'Octavia'],
  ['Toyota', 'Corolla Hybrid'],
  ['Dacia', 'Duster'],
  ['Volkswagen', 'Passat'],
] as const;
export const trailerModels = [
  ['Schmitz Cargobull', 'S.KO'],
  ['Krone', 'Profi Liner'],
  ['Schmitz Cargobull', 'S.CS'],
  ['Krone', 'Cool Liner'],
] as const;
