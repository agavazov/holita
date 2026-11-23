export type DemoVariant = readonly [
  sku: string,
  price: string,
  quantity: number,
  optionValues?: readonly number[],
  inventoryTracked?: boolean,
  purchase?: Readonly<{
    minimumQuantity: number;
    imageId: number;
    barcode: string;
  }>,
];

type DemoProduct = readonly [
  id: number,
  name: string,
  price: string,
  status?: 'active' | 'draft' | 'archived',
  category?: number,
  variants?: readonly DemoVariant[] | undefined,
  descriptions?: Readonly<{ bg: string; en: string }>,
];

type DemoCategory = readonly [
  id: number,
  name: string,
  slug: string,
  parent: number | null,
  sortOrder: number,
];

type DemoOption = readonly [
  id: number,
  name: string,
  values: readonly (readonly [id: number, label: string, swatchColor?: string])[],
  showInListing?: boolean,
];

export const demoOptions: readonly DemoOption[] = [
  [
    1,
    'Цвят',
    [
      [1, 'Пясък'],
      [2, 'Графит'],
    ],
  ],
  [
    2,
    'Размер',
    [
      [3, 'Малък'],
      [4, 'Голям'],
    ],
  ],
  [
    3,
    'Глазура',
    [
      [5, 'Орех', '#735143'],
      [6, 'Мед', '#B8753D'],
      [7, 'Тъмна глина', '#44302B'],
    ],
    true,
  ],
];

// Parents precede their children so the seed can insert the tree in one pass.
export const demoCategories: readonly DemoCategory[] = [
  [1, 'Кухня', 'kitchen', null, 10],
  [3, 'Съдове за готвене', 'cookware', 1, 10],
  [4, 'Сервиране', 'serving', 1, 20],
  [2, 'Дом', 'home', null, 20],
  [5, 'Свещи и аромати', 'candles-and-scents', 2, 10],
  [6, 'Домашен текстил', 'home-textiles', 2, 20],
];

type DemoCollection = {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
} & (
  | { readonly mode: 'manual'; readonly productIds: readonly number[] }
  | { readonly mode: 'category'; readonly categoryId: number }
);

export const demoCollections: readonly DemoCollection[] = [
  {
    id: 1,
    name: 'Kitchen Essentials',
    slug: 'kitchen-essentials',
    mode: 'manual',
    productIds: [52, 15, 51],
  },
  {
    id: 2,
    name: 'Съдове за готвене',
    slug: 'cookware-picks',
    mode: 'category',
    categoryId: 3,
  },
];

type DemoCharacteristicGroup = {
  id: number;
  name: string;
  sortOrder: number;
  categoryId?: number;
  characteristics: readonly {
    id: number;
    name: string;
    sortOrder: number;
    kind?: 'singleChoice' | 'multipleChoice';
    choices?: readonly (readonly [id: number, name: string])[];
  }[];
  values: readonly (readonly [productId: number, characteristicId: number, value: string])[];
  choiceAssignments?: readonly (readonly [
    productId: number,
    characteristicId: number,
    choiceId: number,
  ])[];
};

export const demoCharacteristicGroups: readonly DemoCharacteristicGroup[] = [
  {
    id: 1,
    name: 'Materials',
    sortOrder: 10,
    characteristics: [
      { id: 1, name: 'Material', sortOrder: 10 },
      { id: 2, name: 'Finish', sortOrder: 20 },
    ],
    values: [
      [51, 1, 'Ceramic'],
      [51, 2, 'Matte glaze'],
      [52, 1, 'Oak'],
      [52, 2, 'Food-safe oil'],
    ],
  },
  {
    id: 2,
    name: 'Модели и версии',
    sortOrder: 20,
    categoryId: 3,
    characteristics: [
      {
        id: 3,
        name: 'Модел / версия',
        sortOrder: 10,
        kind: 'singleChoice',
        choices: [
          [1, 'Terra V1'],
          [2, 'Terra V2'],
          [3, 'Terra V3'],
        ],
      },
    ],
    values: [],
    choiceAssignments: [
      [51, 3, 1],
      [55, 3, 2],
      [73, 3, 3],
    ],
  },
];

export const demoBadges = [
  { id: 1, name: 'Ново попълнение', slug: 'novo-popalnenie', color: 'info', productIds: [11, 12] },
] as const;

export const demoTags = [
  { id: 1, name: 'Керамика', slug: 'керамика', productIds: [11, 12] },
  { id: 2, name: 'Ръчна изработка', slug: 'ръчна-изработка', productIds: [11] },
] as const;

export const demoShopper = {
  name: 'Мария Петрова',
  email: 'shopper@demo.holita.test',
  cartSkus: ['GUV-2L', 'PAN-28-SAND'],
};

export const demoCustomers = [
  [4, 'Александра Василева', 'aleksandra.vasileva'],
  [5, 'Антон Маринов', 'anton.marinov'],
  [6, 'Борислава Кръстева', 'borislava.krasteva'],
  [7, 'Васил Георгиев', 'vasil.georgiev'],
  [8, 'Виктория Андреева', 'viktoria.andreeva'],
  [9, 'Георги Тодоров', 'georgi.todorov'],
  [10, 'Десислава Костова', 'desislava.kostova'],
  [11, 'Елена Николова', 'elena.nikolova'],
  [12, 'Емил Димитров', 'emil.dimitrov'],
  [13, 'Зорница Симеонова', 'zornitsa.simeonova'],
  [14, 'Иванка Илиева', 'ivanka.ilieva'],
  [15, 'Калина Ангелова', 'kalina.angelova'],
  [16, 'Любомир Стефанов', 'lyubomir.stefanov'],
  [17, 'Милена Йорданова', 'milena.yordanova'],
  [18, 'Николай Иванов', 'nikolay.ivanov'],
  [19, 'Петя Алексиева', 'petya.aleksieva'],
  [20, 'Ралица Христова', 'ralitsa.hristova'],
  [21, 'Силвия Павлова', 'silvia.pavlova'],
  [22, 'Стефан Попов', 'stefan.popov'],
  [23, 'Теодора Донева', 'teodora.doneva'],
  [24, 'Цветан Русев', 'tsvetan.rusev'],
  [
    25,
    'Яна Александрова-Димитрова Стоянова-Великова',
    'yana.aleksandrova-dimitrova.stoyanova-velikova',
  ],
] as const;

export interface DemoShopperOrder {
  readonly id: number;
  readonly status: string;
  readonly placedAt: string;
  readonly paidAt: string | null;
  readonly statusChanges: readonly (readonly [from: string, to: string, occurredAt: string])[];
  readonly phone: string;
  readonly city: string;
  readonly postalCode: string;
  readonly address: string;
  readonly billingAddress?: {
    readonly name: string;
    readonly phone: string;
    readonly countryCode: string;
    readonly city: string;
    readonly postalCode: string;
    readonly line1: string;
    readonly line2?: string;
  };
  readonly subtotal: string;
  readonly total: string;
  readonly lines: readonly {
    readonly id: number;
    readonly variant: number;
    readonly sku: string;
    readonly label: string;
    readonly quantity: number;
    readonly unitPrice: string;
  }[];
}

export const demoCustomerDetail = {
  id: 2,
  name: 'Диана Стоянова',
  email: 'diana-120@example.test',
  phone: '+359 2 555 0106',
  address: {
    id: 1,
    recipient: 'Диана Стоянова',
    line1: 'ул. „Георги Бенковски“ 24, вход Б',
    city: 'София',
    postalCode: '1000',
    countryCode: 'BG',
  },
  order: {
    id: 7,
    status: 'placed',
    placedAt: '2026-11-22T12:00:00Z',
    paidAt: null,
    statusChanges: [],
    subtotal: '109.80',
    total: '115.80',
    lines: [
      {
        id: 9,
        variant: 580,
        sku: 'DEMO-58',
        label: 'Глинен съд за печене „Орех“, 2 л',
        quantity: 2,
        unitPrice: '54.90',
      },
    ],
  },
};

export const demoPaymentMethod = {
  label: 'Наложен платеж',
  instructions: 'Платете при получаване.',
};
export const demoShippingMethod = { label: 'Доставка до адрес', fixedFee: '3.07' };
export const demoPickupShipping = { label: 'Получаване от магазина', fixedFee: '0.00' };

export const demoBankTransfer = {
  label: 'Банков превод',
  instructions: 'Ще получите указания за банков превод след потвърждение.',
};
export const demoSaturdayShipping = { label: 'Доставка в събота', fixedFee: '4.86' };

export const demoDiscounts = [
  { id: 1, code: 'HOME10', value: '10.00', minSubtotal: '20.45', endsAt: null },
  { id: 2, code: 'OLD10', value: '10.00', minSubtotal: null, endsAt: '2025-01-01T00:00:00Z' },
] as const;

export const demoDashboardCustomer = {
  id: 3,
  daysAgo: 10,
  name: 'Надежда Колева',
  email: 'nadezhda-127@example.test',
  phone: '+359 2 555 0127',
};

export const demoDashboardOrders = [
  {
    id: 9,
    lineId: 11,
    daysAgo: 2,
    quantity: 1,
    status: 'completed',
    subtotal: '27.05',
    total: '30.12',
  },
  {
    id: 10,
    lineId: 12,
    daysAgo: 10,
    quantity: 2,
    status: 'completed',
    subtotal: '54.10',
    total: '57.17',
  },
  {
    id: 11,
    lineId: 13,
    daysAgo: 20,
    quantity: 3,
    status: 'completed',
    subtotal: '81.15',
    total: '84.22',
  },
  {
    id: 12,
    lineId: 14,
    daysAgo: 1,
    quantity: 4,
    status: 'placed',
    subtotal: '108.20',
    total: '111.27',
  },
] as const;

export const demoManualOrder = {
  id: 6,
  placedAt: '2026-11-22T11:00:00Z',
  contactName: 'Елена Тодорова',
  contactEmail: 'elena@demo.holita.test',
  phone: '+359 2 555 0105',
  city: 'София',
  postalCode: '1000',
  address: 'ул. „Граф Игнатиев“ 18',
  merchantNote: 'Поръчка по телефона. Клиентката помоли да се обадим преди доставката.',
  line: {
    id: 8,
    variant: 570,
    sku: 'DEMO-57',
    label: 'Керамична касерола „Горска жарава“, 1,5 л',
    quantity: 2,
    unitPrice: '52.90',
  },
};

export const demoInvoicedManualOrder = {
  ...demoManualOrder,
  id: 8,
  placedAt: '2026-11-23T08:00:00Z',
  contactName: 'Мария Димитрова',
  contactEmail: 'maria@demo.holita.test',
  phone: '+359 2 555 0106',
  address: 'бул. „Александър Стамболийски“ 42',
  merchantNote: 'Поръчка по телефона. Доставка след 16 ч.',
  line: { ...demoManualOrder.line, id: 10, quantity: 1 },
};

export const demoSeparateBillingOrder: DemoShopperOrder = {
  id: 13,
  status: 'placed',
  placedAt: '2026-11-23T09:15:00Z',
  paidAt: null,
  statusChanges: [],
  phone: '+359 2 555 0100',
  city: 'София',
  postalCode: '1000',
  address: 'ул. „Професор Иван Георгов“ 15',
  billingAddress: {
    name: 'Елица Димитрова',
    phone: '+359 32 555 0142',
    countryCode: 'BG',
    city: 'Пловдив',
    postalCode: '4000',
    line1: 'ул. „Иван Вазов“ 24',
    line2: 'ет. 2',
  },
  subtotal: '27.05',
  total: '30.12',
  lines: [{ ...demoManualOrder.line, id: 15, quantity: 1, unitPrice: '27.05' }],
};

export const demoOrders: readonly DemoShopperOrder[] = [
  {
    id: 1,
    status: 'placed',
    placedAt: '2026-11-20T10:00:00Z',
    paidAt: null,
    statusChanges: [],
    phone: '+359 2 555 0100',
    city: 'София',
    postalCode: '1000',
    address: 'ул. „Професор Иван Георгов“ 15',
    subtotal: '107.80',
    total: '113.80',
    lines: [
      {
        id: 1,
        variant: 570,
        sku: 'DEMO-57',
        label: 'Керамична касерола „Горска жарава“, 1,5 л',
        quantity: 1,
        unitPrice: '52.90',
      },
      {
        id: 2,
        variant: 580,
        sku: 'DEMO-58',
        label: 'Глинен съд за печене „Орех“, 2 л',
        quantity: 1,
        unitPrice: '54.90',
      },
    ],
  },
  {
    id: 2,
    status: 'completed',
    placedAt: '2026-11-12T09:30:00Z',
    paidAt: null,
    statusChanges: [],
    phone: '+359 2 555 0100',
    city: 'София',
    postalCode: '1000',
    address: 'ул. „Професор Иван Георгов“ 15',
    subtotal: '105.80',
    total: '111.80',
    lines: [
      {
        id: 3,
        variant: 570,
        sku: 'DEMO-57',
        label: 'Керамична касерола „Горска жарава“, 1,5 л',
        quantity: 2,
        unitPrice: '52.90',
      },
    ],
  },
  {
    id: 3,
    status: 'confirmed',
    placedAt: '2026-11-22T09:15:00Z',
    paidAt: null,
    statusChanges: [['placed', 'confirmed', '2026-11-22T10:00:00Z']],
    phone: '+359 2 555 0100',
    city: 'София',
    postalCode: '1000',
    address: 'ул. „Професор Иван Георгов“ 15',
    subtotal: '109.80',
    total: '115.80',
    lines: [
      {
        id: 4,
        variant: 580,
        sku: 'DEMO-58',
        label: 'Глинен съд за печене „Орех“, 2 л',
        quantity: 2,
        unitPrice: '54.90',
      },
    ],
  },
  {
    id: 4,
    status: 'shipped',
    placedAt: '2026-11-18T08:30:00Z',
    paidAt: '2026-11-21T14:45:00Z',
    statusChanges: [
      ['placed', 'confirmed', '2026-11-18T10:00:00Z'],
      ['confirmed', 'processing', '2026-11-19T09:00:00Z'],
      ['processing', 'shipped', '2026-11-20T15:20:00Z'],
    ],
    phone: '+359 2 555 0100',
    city: 'София',
    postalCode: '1000',
    address: 'ул. „Професор Иван Георгов“ 15',
    subtotal: '107.80',
    total: '113.80',
    lines: [
      {
        id: 5,
        variant: 570,
        sku: 'DEMO-57',
        label: 'Керамична касерола „Горска жарава“, 1,5 л',
        quantity: 1,
        unitPrice: '52.90',
      },
      {
        id: 6,
        variant: 580,
        sku: 'DEMO-58',
        label: 'Глинен съд за печене „Орех“, 2 л',
        quantity: 1,
        unitPrice: '54.90',
      },
    ],
  },
  {
    id: 5,
    status: 'confirmed',
    placedAt: '2026-11-21T08:30:00Z',
    paidAt: '2026-11-21T09:00:00Z',
    statusChanges: [['placed', 'confirmed', '2026-11-21T08:45:00Z']],
    phone: '+359 2 555 0100',
    city: 'София',
    postalCode: '1000',
    address: 'ул. „Професор Иван Георгов“ 15',
    subtotal: '105.80',
    total: '111.80',
    lines: [
      {
        id: 7,
        variant: 570,
        sku: 'DEMO-57',
        label: 'Керамична касерола „Горска жарава“, 1,5 л',
        quantity: 2,
        unitPrice: '52.90',
      },
    ],
  },
];

export const demoInvoice = {
  id: 1,
  firstLineId: 1,
  order: 4,
  number: '0000000001',
  issueDate: '2026-11-21',
  issuerName: 'Домашни находки София ООД',
  issuerCompanyId: '000000001',
  issuerVatNumber: 'BG000000001',
  issuerAddress: 'ул. „Керамична работилница“ 12, 1000 София',
};

export const demoManualOrderInvoice = {
  ...demoInvoice,
  id: 2,
  firstLineId: 3,
  order: demoInvoicedManualOrder.id,
  number: '0000000002',
  issueDate: '2026-11-23',
};

export const demoRefund = {
  order: 5,
  amount: '15.00',
  reason: 'Частично възстановяване след уговорка с клиента.',
  createdAt: '2026-11-22T11:30:00Z',
} as const;

interface DemoBrand {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly products: readonly DemoProduct[];
}

// Keep these fixture IDs stable. Catalogue prices are in EUR.
export const demoCatalogue: readonly DemoBrand[] = [
  {
    id: 11,
    name: 'Глина и жар',
    slug: 'glina-i-zhar',
    products: [
      [11, 'Глинена купа за салата „Медена глазура“', '22.96'],
      [12, 'Каменинова чаша за кафе „Пясък“, 280 мл', '10.17'],
      [13, 'Плитка керамична чиния „Маслина“, 26 см', '14.57'],
      [14, 'Керамична кана за вода „Жарава“, 1 л', '29.65'],
      [15, 'Сервиз за закуска „Първа светлина“, 6 части', '60.84', 'draft'],
      [51, 'Керамична тава за печене „Горска глина“, 30 см', '33.18', 'active', 3],
      [55, 'Керамичен гювеч „Бавен огън“, 2 л', '25.00', 'active', 3, [['GUV-2L', '25.00', 12]]],
      [
        56,
        'Чугунен тиган „Две дръжки“, 28 см',
        '40.85',
        'active',
        3,
        [
          ['PAN-28-SAND', '40.85', 7, [1]],
          ['PAN-28-GRAPHITE', '43.41', 4, [2]],
        ],
      ],
      [
        70,
        'Чугунен тиган „Графит“, 24 см',
        '35.74',
        'active',
        3,
        [['PAN-24-GRAPHITE', '35.74', 0, [2], true]],
      ],
      [
        57,
        'Керамична касерола „Горска жарава“, 1,5 л',
        '27.05',
        'active',
        3,
        undefined,
        {
          bg: 'Керамична касерола с капак за бавно готвене и печене.',
          en: 'A lidded ceramic casserole for slow cooking and baking.',
        },
      ],
      [
        58,
        'Глинен съд за печене „Орех“, 2 л',
        '28.07',
        'active',
        3,
        undefined,
        {
          bg: 'Глазиран глинен съд с капак и две дръжки за бавно печене.',
          en: 'A glazed earthenware pot with a lid and two handles for slow baking.',
        },
      ],
      [
        59,
        'Бежова глинена касерола „Жарава“, 1,5 л',
        '25.51',
        'active',
        3,
        [['DL-111-SOLD', '25.51', 0, [], true]],
        {
          bg: 'Глинена касерола с капак и светла глазура за бавно печене.',
          en: 'A lidded clay casserole with a light glaze for slow baking.',
        },
      ],
      [
        60,
        'Бяла керамична тенджера „Млечен път“, 2 л',
        '30.63',
        'active',
        3,
        [['DL-111-FREE', '30.63', 0, [], false]],
        {
          bg: 'Керамична тенджера с две дръжки и капак за приготвяне на ястия във фурната.',
          en: 'A ceramic pot with two handles and a lid for oven cooking.',
        },
      ],
      [
        71,
        'Керамичен съд „Пясъчна глина“',
        '20.40',
        'active',
        3,
        [
          ['DEMO-71-SAND-S', '20.40', 0, [1, 3]],
          ['DEMO-71-GRAPHITE-L', '25.51', 6, [2, 4]],
        ],
        {
          bg: 'Керамичен съд с две дръжки за печене и сервиране.',
          en: 'A two-handled ceramic dish for baking and serving.',
        },
      ],
      [
        72,
        'Каменинова купа „Дюна“, 18 см',
        '16.82',
        'draft',
        4,
        [['KUPA-DUNA-18-PYASAK', '16.82', 8, [1]]],
      ],
      [
        73,
        'Керамичен съд с капак „Орехова жарава“, 2 л',
        '28.70',
        'active',
        3,
        [
          [
            'TERRA-OR-2',
            '28.70',
            8,
            [5],
            true,
            { minimumQuantity: 2, imageId: 730, barcode: '0012345678905' },
          ],
          [
            'TERRA-MED-2',
            '30.20',
            9,
            [6],
            true,
            { minimumQuantity: 3, imageId: 731, barcode: '0012345678912' },
          ],
          [
            'TERRA-GLINA-2',
            '29.60',
            1,
            [7],
            true,
            { minimumQuantity: 2, imageId: 732, barcode: '0012345678929' },
          ],
        ],
        {
          bg: 'Керамичен съд с капак за бавно печене. Изберете глазурата за вашата трапеза.',
          en: 'A ceramic pot with a lid for slow baking. Choose a glaze for your table.',
        },
      ],
    ],
  },
  {
    id: 12,
    name: 'Дъб и длето',
    slug: 'dab-i-dleto',
    products: [
      [16, 'Дъбова дъска за сервиране „Рила“, 38 см', '28.07'],
      [17, 'Дървена шпатула от орех, 30 см', '7.93'],
      [18, 'Кръгла дъска за сирена от ясен, 28 см', '21.93'],
      [19, 'Мелничка за пипер от дъб, 21 см', '25.05'],
      [20, 'Орехова табла за кафе, 36 × 24 см', '38.86'],
      [52, 'Дъбова купа за сервиране „Горски плодове“, 24 см', '31.70', 'active', 4],
    ],
  },
  {
    id: 13,
    name: 'Ленено утро',
    slug: 'leneno-utro',
    products: [
      [21, 'Ленена покривка „Овес“, 140 × 180 см', '43.97'],
      [22, 'Две ленени салфетки „Салвия“, 42 × 42 см', '12.73'],
      [23, 'Кухненска кърпа от лен „Небе“, 50 × 70 см', '9.15'],
      [24, 'Ленена престилка „Мак“ с джоб', '25.51'],
      [25, 'Тишлайфер „Бяло жито“, 45 × 150 см', '19.17', 'archived'],
    ],
  },
  {
    id: 14,
    name: 'Медна лъжица',
    slug: 'medna-lazhitsa',
    products: [
      [26, 'Медно джезве с дървена дръжка, 350 мл', '23.52'],
      [27, 'Мерителни лъжички от неръждаема стомана, 4 бр.', '11.71'],
      [28, 'Кухненска цедка от стомана, 15 см', '12.53'],
      [29, 'Медна купа за разбиване, 1,8 л', '45.50', 'draft'],
      [30, 'Месингова лъжичка за кафе, 12 см', '7.11'],
    ],
  },
  {
    id: 15,
    name: 'Стъклен двор',
    slug: 'staklen-dvor',
    products: [
      [31, 'Бутилка от релефно стъкло „Роса“, 750 мл', '12.73'],
      [32, 'Две чаши от опушено стъкло „Мъгла“, 320 мл', '15.29'],
      [33, 'Стъклена гарафа „Извор“, 1,2 л', '18.41'],
      [34, 'Стъклен буркан с дървен капак, 900 мл', '10.99'],
      [35, 'Ваза от зелено стъкло „Речен камък“, 22 см', '24.54'],
    ],
  },
  {
    id: 16,
    name: 'Тих пламък',
    slug: 'tih-plamak',
    products: [
      [36, 'Ароматна свещ „Смокинов лист“, 180 г', '16.82'],
      [37, 'Свещ от пчелен восък „Кехлибар“, 2 бр.', '12.73'],
      [38, 'Соева свещ „Кедър и портокал“, 240 г', '19.43'],
      [39, 'Керамичен свещник „Полумесец“, 9 см', '11.25'],
      [40, 'Подаръчен комплект „Зимна вечер“', '30.17', 'archived'],
      [53, 'Ароматна свещ „Топла ванилия“, 210 г', '18.36', 'active', 5],
    ],
  },
  {
    id: 17,
    name: 'Балканска тъкан',
    slug: 'balkanska-takan',
    products: [
      [41, 'Вълнено одеяло „Родопа“, 130 × 170 см', '71.07'],
      [42, 'Калъфка за възглавница „Теракота“, 45 × 45 см', '17.84'],
      [43, 'Памучна постелка „Каменна пътека“, 60 × 90 см', '29.60'],
      [44, 'Две тъкани подложки „Кантарион“, 35 × 45 см', '13.29'],
      [45, 'Ръчно тъкан килим „Янтра“, 80 × 150 см', '96.63', 'draft'],
      [54, 'Вълнено одеяло „Тиха вечер“, 140 × 180 см', '76.18', 'active', 6],
    ],
  },
  {
    id: 18,
    name: 'Бяла бреза',
    slug: 'byala-breza',
    products: [
      [46, 'Брезова кутия за чай с шест отделения', '22.50'],
      [47, 'Плетена кошница за хляб „Върба“, 26 см', '14.83'],
      [48, 'Дървен органайзер за прибори „Бреза“, 34 см', '20.40'],
      [49, 'Комплект коркови подложки за чаши, 6 бр.', '8.64'],
      [50, 'Стенна закачалка от бреза с три куки', '25.00', 'archived'],
    ],
  },
];

type DemoImage = readonly [id: number, file: string, altText: string];

export const demoProductImages: Readonly<Record<number, readonly DemoImage[]>> = {
  1: [[10, 'product-1.png', 'Natural canvas tote with two shoulder straps']],
  11: [[110, 'product-11.png', 'Глинена купа с медена глазура']],
  12: [[120, 'product-12.png', 'Каменинова чаша в пясъчен цвят']],
  13: [[130, 'product-13.png', 'Плитка чиния с маслиненозелена глазура']],
  14: [[140, 'product-14.png', 'Керамична кана с дръжка и чучур']],
  22: [[220, 'product-22.png', 'Две сгънати ленени салфетки в цвят салвия']],
  31: [[310, 'product-31.png', 'Прозрачна бутилка с релефни линии и стъклена запушалка']],
  35: [[350, 'product-35.png', 'Зелена стъклена ваза с релефна повърхност']],
  36: [[360, 'product-36.png', 'Свещ в тъмнозелен буркан със смокинов лист до нея']],
  41: [[410, 'product-41.png', 'Сгънато синьо-сиво вълнено одеяло с ресни']],
  44: [[440, 'product-44.png', 'Две квадратни тъкани подложки в сламен цвят']],
  46: [[460, 'product-46.png', 'Отворена брезова кутия с шест отделения за чай']],
  53: [[530, 'product-53.png', 'Ванилова свещ в кехлибарен стъклен буркан']],
  54: [[540, 'product-54.png', 'Сгънато бежово вълнено одеяло с кафяви ивици']],
  58: [
    [580, 'product-58-front.png', 'Глинен съд „Орех“ с капак, изглед отпред'],
    [581, 'product-58-angle.png', 'Глинен съд „Орех“ с капак, изглед под ъгъл'],
    [582, 'product-58-inside.png', 'Глазираната вътрешност на съда „Орех“ и капакът отстрани'],
  ],
  73: [
    [730, 'product-58-front.png', 'Керамичен съд с капак, изглед отпред'],
    [731, 'product-58-angle.png', 'Керамичен съд, изглед под ъгъл'],
    [732, 'product-58-inside.png', 'Глазирана вътрешност на керамичния съд'],
  ],
};

export const demoPages = [
  {
    id: 1,
    slug: 'about-us',
    status: 'published',
    titleBg: 'За нас',
    bodyBg:
      'Подбираме съдове, текстил и вещи за дома, които с удоволствие ще използвате всеки ден. Работим с малки производители и търсим естествени материали, удобни форми и изработка, която издържа на ежедневна употреба.\n\nОт София изпращаме всичко за масата и кухнята — от глинени купи и ленени покривки до дървени дъски за споделени вечери.',
    titleEn: 'About Us',
    bodyEn:
      'We choose tableware, textiles and home goods you will enjoy using every day. We work with small makers and look for natural materials, practical shapes and craftsmanship that holds up to daily use.\n\nFrom Sofia, we ship essentials for the table and kitchen, from clay bowls and linen tablecloths to wooden boards for shared suppers.',
  },
  {
    id: 2,
    slug: 'delivery-information',
    status: 'published',
    titleBg: 'Информация за доставката',
    bodyBg:
      'Подготвяме пратките в работни дни. Ще видите наличните начини за доставка и цената им, преди да потвърдите поръчката.\n\nУвиваме керамиката и стъклото поотделно. Ако получите повреден съд, запазете опаковката, за да ни помогнете да установим какво се е случило.',
    titleEn: 'Delivery Information',
    bodyEn:
      'We pack orders on working days. You can see the available delivery methods and their prices before confirming your order.\n\nWe wrap ceramic and glass items individually. If an item arrives damaged, keep the packaging so you can help us work out what happened.',
  },
  {
    id: 3,
    slug: 'care-guide',
    status: 'draft',
    titleBg: 'Грижа за съдовете',
    bodyBg: 'Оставяйте нагорещените съдове да изстинат, преди да ги измиете с хладка вода.',
    titleEn: null,
    bodyEn: null,
  },
] as const;

export const demoNavigationMenus = [
  {
    id: 1,
    placement: 'header',
    links: [
      { id: 1, type: 'category', target: 1, labelBg: 'Кухня', labelEn: 'Kitchen' },
      { id: 2, type: 'blog', labelBg: 'Блог', labelEn: 'Blog' },
    ],
  },
  {
    id: 2,
    placement: 'footer',
    links: [
      { id: 3, type: 'page', target: 1, labelBg: 'За нас', labelEn: 'About Us' },
      {
        id: 4,
        type: 'page',
        target: 2,
        labelBg: 'Информация за доставката',
        labelEn: 'Delivery Information',
      },
    ],
  },
] as const;

export const demoShopSettings = {
  displayName: 'Дом и уют',
  contactEmail: 'hello@dom-i-uyut.example.test',
  contactPhone: '+359 2 000 0000',
  contactAddress: 'ул. „Примерна“ 12, 1000 София',
} as const;

export const demoBlogTags = [{ id: 1, name: 'Грижа за съдовете', slug: 'cookware-care' }] as const;

export const demoBlogArticles = [
  {
    id: 1,
    slug: 'care-for-cast-iron',
    status: 'published',
    publishedAt: '2026-11-20T09:00:00Z',
    titleBg: 'Как да се грижим за чугуна',
    bodyBg:
      'Оставете тигана да изстине след готвене. Измийте го с топла вода и мека четка, след което го подсушете веднага.\n\nПреди да го приберете, нанесете няколко капки олио с кърпа. Избършете излишното, за да остане само тънък защитен слой.',
    titleEn: 'How to care for cast iron',
    bodyEn:
      'Let the pan cool after cooking. Wash it with warm water and a soft brush, then dry it right away.\n\nBefore putting it away, rub in a few drops of cooking oil with a cloth. Wipe off the excess to leave a thin protective layer.',
    tagIds: [1],
  },
  {
    id: 2,
    slug: 'clean-stoneware',
    status: 'published',
    publishedAt: '2026-11-17T09:00:00Z',
    titleBg: 'Почистване на каменинови съдове',
    bodyBg:
      'За всекидневно почистване използвайте мека гъба и топла вода. Ако има засъхнали остатъци, оставете съда за кратко да се накисне.\n\nИзбягвайте резките промени в температурата. Оставете съда от фурната да изстине върху дървена дъска, преди да го измиете.',
    titleEn: 'Cleaning stoneware',
    bodyEn:
      'For everyday cleaning, use a soft sponge and warm water. Briefly soak the dish if food has dried onto it.\n\nAvoid sudden temperature changes. Let an oven dish cool on a wooden board before washing it.',
    tagIds: [1],
  },
  {
    id: 3,
    slug: 'seasonal-kitchen-notes',
    status: 'draft',
    publishedAt: null,
    titleBg: 'Сезонни бележки от кухнята',
    bodyBg:
      'Преди зимата преглеждаме съдовете за печене и отделяме най-удобните за топли вечери у дома.',
    titleEn: null,
    bodyEn: null,
    tagIds: [1],
  },
] as const;

export const demoProductCovers: Readonly<Record<number, readonly DemoImage[]>> = {
  15: [[150, 'product-15.webp', 'Сервиз за закуска „Първа светлина“, 6 части']],
  16: [[160, 'product-16.webp', 'Дъбова дъска за сервиране „Рила“, 38 см']],
  17: [[170, 'product-17.webp', 'Дървена шпатула от орех, 30 см']],
  18: [[180, 'product-18.webp', 'Кръгла дъска за сирена от ясен, 28 см']],
  19: [[190, 'product-19.webp', 'Мелничка за пипер от дъб, 21 см']],
  20: [[200, 'product-20.webp', 'Орехова табла за кафе, 36 × 24 см']],
  21: [[210, 'product-21.webp', 'Ленена покривка „Овес“, 140 × 180 см']],
  23: [[230, 'product-23.webp', 'Кухненска кърпа от лен „Небе“, 50 × 70 см']],
  24: [[240, 'product-24.webp', 'Ленена престилка „Мак“ с джоб']],
  25: [[250, 'product-25.webp', 'Тишлайфер „Бяло жито“, 45 × 150 см']],
  26: [[260, 'product-26.webp', 'Медно джезве с дървена дръжка, 350 мл']],
  27: [[270, 'product-27.webp', 'Мерителни лъжички от неръждаема стомана, 4 бр.']],
  28: [[280, 'product-28.webp', 'Кухненска цедка от стомана, 15 см']],
  29: [[290, 'product-29.webp', 'Медна купа за разбиване, 1,8 л']],
  30: [[300, 'product-30.webp', 'Месингова лъжичка за кафе, 12 см']],
  32: [[320, 'product-32.webp', 'Две чаши от опушено стъкло „Мъгла“, 320 мл']],
  33: [[330, 'product-33.webp', 'Стъклена гарафа „Извор“, 1,2 л']],
  34: [[340, 'product-34.webp', 'Стъклен буркан с дървен капак, 900 мл']],
  37: [[370, 'product-37.webp', 'Свещ от пчелен восък „Кехлибар“, 2 бр.']],
  38: [[380, 'product-38.webp', 'Соева свещ „Кедър и портокал“, 240 г']],
  39: [[390, 'product-39.webp', 'Керамичен свещник „Полумесец“, 9 см']],
  40: [[400, 'product-40.webp', 'Подаръчен комплект „Зимна вечер“']],
  42: [[420, 'product-42.webp', 'Калъфка за възглавница „Теракота“, 45 × 45 см']],
  43: [[430, 'product-43.webp', 'Памучна постелка „Каменна пътека“, 60 × 90 см']],
  45: [[450, 'product-45.webp', 'Ръчно тъкан килим „Янтра“, 80 × 150 см']],
  47: [[470, 'product-47.webp', 'Плетена кошница за хляб „Върба“, 26 см']],
  48: [[480, 'product-48.webp', 'Дървен органайзер за прибори „Бреза“, 34 см']],
  49: [[490, 'product-49.webp', 'Комплект коркови подложки за чаши, 6 бр.']],
  50: [[500, 'product-50.webp', 'Стенна закачалка от бреза с три куки']],
  51: [[510, 'product-51.webp', 'Керамична тава за печене „Горска глина“, 30 см']],
  52: [[520, 'product-52.webp', 'Дъбова купа за сервиране „Горски плодове“, 24 см']],
  55: [[550, 'product-55.webp', 'Керамичен гювеч „Бавен огън“, 2 л']],
  56: [[560, 'product-56.webp', 'Чугунен тиган „Две дръжки“, 28 см']],
  57: [[570, 'product-57.webp', 'Керамична касерола „Горска жарава“, 1,5 л']],
  59: [[590, 'product-59.webp', 'Бежова глинена касерола „Жарава“, 1,5 л']],
  60: [[600, 'product-60.webp', 'Бяла керамична тенджера „Млечен път“, 2 л']],
  70: [[700, 'product-56.webp', 'Чугунен тиган в цвят графит']],
  71: [[710, 'product-71.webp', 'Пясъчен керамичен съд с две дръжки']],
};
