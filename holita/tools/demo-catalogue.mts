type DemoVariant = readonly [
  sku: string,
  price: string,
  quantity: number,
  optionValues?: readonly number[],
  inventoryTracked?: boolean,
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
  values: readonly (readonly [id: number, label: string])[],
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

export const demoCharacteristicGroups = [
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
    ] as const,
  },
];

export const demoBadges = [
  { id: 1, name: 'Ново попълнение', slug: 'novo-popalnenie', color: 'info', productIds: [11, 12] },
] as const;

export const demoTags = [
  { id: 1, name: 'Керамика', slug: 'керамика', productIds: [11, 12] },
  { id: 2, name: 'Ръчна изработка', slug: 'ръчна-изработка', productIds: [11] },
] as const;

interface DemoBrand {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly products: readonly DemoProduct[];
}

// Keep these fixture IDs stable when adding products or extending their data.
export const demoCatalogue: readonly DemoBrand[] = [
  {
    id: 11,
    name: 'Глина и жар',
    slug: 'glina-i-zhar',
    products: [
      [11, 'Глинена купа за салата „Медена глазура“', '44.90'],
      [12, 'Каменинова чаша за кафе „Пясък“, 280 мл', '19.90'],
      [13, 'Плитка керамична чиния „Маслина“, 26 см', '28.50'],
      [14, 'Керамична кана за вода „Жарава“, 1 л', '58.00'],
      [15, 'Сервиз за закуска „Първа светлина“, 6 части', '119.00', 'draft'],
      [51, 'Керамична тава за печене „Горска глина“, 30 см', '64.90', 'active', 3],
      [55, 'Керамичен гювеч „Бавен огън“, 2 л', '48.90', 'active', 3, [['GUV-2L', '48.90', 12]]],
      [
        56,
        'Чугунен тиган „Две дръжки“, 28 см',
        '79.90',
        'active',
        3,
        [
          ['PAN-28-SAND', '79.90', 7, [1]],
          ['PAN-28-GRAPHITE', '84.90', 4, [2]],
        ],
      ],
      [
        70,
        'Чугунен тиган „Графит“, 24 см',
        '69.90',
        'active',
        3,
        [['PAN-24-GRAPHITE', '69.90', 0, [2], true]],
      ],
      [
        57,
        'Керамична касерола „Горска жарава“, 1,5 л',
        '52.90',
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
        '54.90',
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
        '49.90',
        'active',
        3,
        [['DL-111-SOLD', '49.90', 0, [], true]],
        {
          bg: 'Глинена касерола с капак и светла глазура за бавно печене.',
          en: 'A lidded clay casserole with a light glaze for slow baking.',
        },
      ],
      [
        60,
        'Бяла керамична тенджера „Млечен път“, 2 л',
        '59.90',
        'active',
        3,
        [['DL-111-FREE', '59.90', 0, [], false]],
        {
          bg: 'Керамична тенджера с две дръжки и капак за приготвяне на ястия във фурната.',
          en: 'A ceramic pot with two handles and a lid for oven cooking.',
        },
      ],
      [
        71,
        'Керамичен съд „Пясъчна глина“',
        '39.90',
        'active',
        3,
        [
          ['DEMO-71-SAND-S', '39.90', 0, [1, 3]],
          ['DEMO-71-GRAPHITE-L', '49.90', 6, [2, 4]],
        ],
        {
          bg: 'Керамичен съд с две дръжки за печене и сервиране.',
          en: 'A two-handled ceramic dish for baking and serving.',
        },
      ],
    ],
  },
  {
    id: 12,
    name: 'Дъб и длето',
    slug: 'dab-i-dleto',
    products: [
      [16, 'Дъбова дъска за сервиране „Рила“, 38 см', '54.90'],
      [17, 'Дървена шпатула от орех, 30 см', '15.50'],
      [18, 'Кръгла дъска за сирена от ясен, 28 см', '42.90'],
      [19, 'Мелничка за пипер от дъб, 21 см', '49.00'],
      [20, 'Орехова табла за кафе, 36 × 24 см', '76.00'],
      [52, 'Дъбова купа за сервиране „Горски плодове“, 24 см', '62.00', 'active', 4],
    ],
  },
  {
    id: 13,
    name: 'Ленено утро',
    slug: 'leneno-utro',
    products: [
      [21, 'Ленена покривка „Овес“, 140 × 180 см', '86.00'],
      [22, 'Две ленени салфетки „Салвия“, 42 × 42 см', '24.90'],
      [23, 'Кухненска кърпа от лен „Небе“, 50 × 70 см', '17.90'],
      [24, 'Ленена престилка „Мак“ с джоб', '49.90'],
      [25, 'Тишлайфер „Бяло жито“, 45 × 150 см', '37.50', 'archived'],
    ],
  },
  {
    id: 14,
    name: 'Медна лъжица',
    slug: 'medna-lazhitsa',
    products: [
      [26, 'Медно джезве с дървена дръжка, 350 мл', '46.00'],
      [27, 'Мерителни лъжички от неръждаема стомана, 4 бр.', '22.90'],
      [28, 'Кухненска цедка от стомана, 15 см', '24.50'],
      [29, 'Медна купа за разбиване, 1,8 л', '89.00', 'draft'],
      [30, 'Месингова лъжичка за кафе, 12 см', '13.90'],
    ],
  },
  {
    id: 15,
    name: 'Стъклен двор',
    slug: 'staklen-dvor',
    products: [
      [31, 'Бутилка от релефно стъкло „Роса“, 750 мл', '24.90'],
      [32, 'Две чаши от опушено стъкло „Мъгла“, 320 мл', '29.90'],
      [33, 'Стъклена гарафа „Извор“, 1,2 л', '36.00'],
      [34, 'Стъклен буркан с дървен капак, 900 мл', '21.50'],
      [35, 'Ваза от зелено стъкло „Речен камък“, 22 см', '48.00'],
    ],
  },
  {
    id: 16,
    name: 'Тих пламък',
    slug: 'tih-plamak',
    products: [
      [36, 'Ароматна свещ „Смокинов лист“, 180 г', '32.90'],
      [37, 'Свещ от пчелен восък „Кехлибар“, 2 бр.', '24.90'],
      [38, 'Соева свещ „Кедър и портокал“, 240 г', '38.00'],
      [39, 'Керамичен свещник „Полумесец“, 9 см', '22.00'],
      [40, 'Подаръчен комплект „Зимна вечер“', '59.00', 'archived'],
      [53, 'Ароматна свещ „Топла ванилия“, 210 г', '35.90', 'active', 5],
    ],
  },
  {
    id: 17,
    name: 'Балканска тъкан',
    slug: 'balkanska-takan',
    products: [
      [41, 'Вълнено одеяло „Родопа“, 130 × 170 см', '139.00'],
      [42, 'Калъфка за възглавница „Теракота“, 45 × 45 см', '34.90'],
      [43, 'Памучна постелка „Каменна пътека“, 60 × 90 см', '57.90'],
      [44, 'Две тъкани подложки „Кантарион“, 35 × 45 см', '26.00'],
      [45, 'Ръчно тъкан килим „Янтра“, 80 × 150 см', '189.00', 'draft'],
      [54, 'Вълнено одеяло „Тиха вечер“, 140 × 180 см', '149.00', 'active', 6],
    ],
  },
  {
    id: 18,
    name: 'Бяла бреза',
    slug: 'byala-breza',
    products: [
      [46, 'Брезова кутия за чай с шест отделения', '44.00'],
      [47, 'Плетена кошница за хляб „Върба“, 26 см', '29.00'],
      [48, 'Дървен органайзер за прибори „Бреза“, 34 см', '39.90'],
      [49, 'Комплект коркови подложки за чаши, 6 бр.', '16.90'],
      [50, 'Стенна закачалка от бреза с три куки', '48.90', 'archived'],
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
};

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
};
