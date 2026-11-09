import type { ErmEventCategory, ErmEventSeverity } from '../generated/graphql/types.js';

// Vendor names: StarLink archive authenticated/pages/E0.md (including unlinked event 17).
// Category and severity are discocan presentation classifications.
const entries: readonly [string, string, string, ErmEventCategory, ErmEventSeverity][] = [
  ['01', 'Location report', 'Отчет за местоположение', 'POSITION', 'INFO'],
  ['02', 'Diagnostic report', 'Диагностичен отчет', 'ALARM', 'WARNING'],
  ['03', 'eConnect', 'eConnect', 'STATUS', 'INFO'],
  ['04', 'Ignition turned on', 'Включен контакт', 'STATUS', 'INFO'],
  ['05', 'Ignition turned off', 'Изключен контакт', 'STATUS', 'INFO'],
  ['06', 'Speed limit', 'Ограничение на скоростта', 'ALARM', 'WARNING'],
  ['07', 'Entered geo-zone', 'Влизане в геозона', 'STATUS', 'INFO'],
  ['08', 'Exited geo-zone', 'Излизане от геозона', 'STATUS', 'INFO'],
  ['09', 'Car battery disconnected', 'Акумулаторът на автомобила е разкачен', 'ALARM', 'WARNING'],
  ['10', 'Car battery reconnected', 'Акумулаторът на автомобила е свързан', 'ALARM', 'INFO'],
  ['11', 'Internal backup battery is low', 'Нисък заряд на резервната батерия', 'ALARM', 'WARNING'],
  ['12', 'Voltage below threshold', 'Напрежение под прага', 'ALARM', 'WARNING'],
  ['13', 'Voltage above threshold', 'Напрежение над прага', 'ALARM', 'WARNING'],
  ['14', 'Digital input low', 'Ниско ниво на цифров вход', 'STATUS', 'INFO'],
  ['15', 'Digital input high', 'Високо ниво на цифров вход', 'STATUS', 'INFO'],
  ['16', 'iButton changed', 'Променен iButton', 'STATUS', 'INFO'],
  [
    '17',
    'External alarm state changed',
    'Променено състояние на външната аларма',
    'ALARM',
    'WARNING',
  ],
  ['18', 'Tracking', 'Проследяване', 'POSITION', 'INFO'],
  ['19', 'Immobilizer: Armed', 'Имобилайзер: активиран', 'STATUS', 'INFO'],
  ['20', 'Immobilizer: Disarmed', 'Имобилайзер: деактивиран', 'STATUS', 'INFO'],
  ['21', 'Immobilizer: Wrong code', 'Имобилайзер: грешен код', 'ALARM', 'WARNING'],
  ['22', 'Idle excessive', 'Прекомерен престой на празен ход', 'ALARM', 'WARNING'],
  ['23', 'Network changed', 'Променена мрежа', 'STATUS', 'INFO'],
  ['24', 'Engine on', 'Включен двигател', 'STATUS', 'INFO'],
  ['25', 'Engine off', 'Изключен двигател', 'STATUS', 'INFO'],
  ['26', 'Tow detection', 'Засечено теглене', 'ALARM', 'CRITICAL'],
  ['27', 'Motorcycle alarm: Alarm', 'Аларма за мотоциклет: тревога', 'ALARM', 'CRITICAL'],
  ['28', 'Motorcycle alarm: Armed', 'Аларма за мотоциклет: активирана', 'STATUS', 'INFO'],
  ['29', 'Motorcycle alarm: Disarmed', 'Аларма за мотоциклет: деактивирана', 'STATUS', 'INFO'],
  ['30', 'Motorcycle alarm: Valet mode', 'Аларма за мотоциклет: сервизен режим', 'STATUS', 'INFO'],
  ['31', 'Motorcycle fall detected', 'Засечено падане на мотоциклет', 'ALARM', 'WARNING'],
  ['32', 'Motorcycle accident detected', 'Засечена катастрофа с мотоциклет', 'ALARM', 'CRITICAL'],
  ['33', 'External device', 'Външно устройство', 'EDATA', 'INFO'],
  ['34', 'Drive destination selected', 'Избрана дестинация', 'STATUS', 'INFO'],
  ['35', 'Immobilizer: Violation', 'Имобилайзер: нарушение', 'ALARM', 'CRITICAL'],
  ['36', 'Panic', 'Паник бутон', 'ALARM', 'CRITICAL'],
  ['37', 'Voice callback', 'Обратно гласово повикване', 'STATUS', 'INFO'],
  ['38', 'Voice call started', 'Започнато гласово повикване', 'STATUS', 'INFO'],
  ['39', 'Voice call ended', 'Приключило гласово повикване', 'STATUS', 'INFO'],
  ['40', 'Drive rule occurred', 'Задействано правило за шофиране', 'STATUS', 'INFO'],
  ['41', 'Accident detected', 'Засечена катастрофа', 'ALARM', 'CRITICAL'],
  ['42', 'Jamming detected', 'Засечено заглушаване', 'ALARM', 'CRITICAL'],
  ['43', 'Jamming ended', 'Край на заглушаването', 'ALARM', 'INFO'],
  ['44', 'Movement detected', 'Засечено движение', 'STATUS', 'INFO'],
  ['45', 'End of movement detected', 'Засечен край на движението', 'STATUS', 'INFO'],
  ['46', 'iButton attached', 'iButton е свързан', 'STATUS', 'INFO'],
  ['47', 'iButton detached', 'iButton е разкачен', 'STATUS', 'INFO'],
  ['48', 'Custom Event #1', 'Потребителско събитие №1', 'STATUS', 'INFO'],
  ['49', 'Custom Event #2', 'Потребителско събитие №2', 'STATUS', 'INFO'],
  ['50', 'Custom Event #3', 'Потребителско събитие №3', 'STATUS', 'INFO'],
  ['51', 'Custom Event #4', 'Потребителско събитие №4', 'STATUS', 'INFO'],
  ['52', 'Custom Event #5', 'Потребителско събитие №5', 'STATUS', 'INFO'],
  ['53', 'Custom Event #6', 'Потребителско събитие №6', 'STATUS', 'INFO'],
  ['54', 'Custom Event #7', 'Потребителско събитие №7', 'STATUS', 'INFO'],
  ['55', 'Custom Event #8', 'Потребителско събитие №8', 'STATUS', 'INFO'],
  ['56', 'Temperature event', 'Температурно събитие', 'ALARM', 'WARNING'],
  ['57', 'Geo zone duration', 'Продължителност в геозона', 'STATUS', 'INFO'],
  ['58', 'Driving started', 'Начало на шофиране', 'STATUS', 'INFO'],
  ['59', 'Driving ended', 'Край на шофирането', 'STATUS', 'INFO'],
  ['60', 'Custom Event #9', 'Потребителско събитие №9', 'STATUS', 'INFO'],
  ['61', 'Custom Event #10', 'Потребителско събитие №10', 'STATUS', 'INFO'],
  ['62', 'Custom Event #11', 'Потребителско събитие №11', 'STATUS', 'INFO'],
  ['63', 'Custom Event #12', 'Потребителско събитие №12', 'STATUS', 'INFO'],
  ['64', 'Custom Event #13', 'Потребителско събитие №13', 'STATUS', 'INFO'],
  ['65', 'Custom Event #14', 'Потребителско събитие №14', 'STATUS', 'INFO'],
  ['66', 'Custom Event #15', 'Потребителско събитие №15', 'STATUS', 'INFO'],
  ['67', 'Custom Event #16', 'Потребителско събитие №16', 'STATUS', 'INFO'],
  ['68', 'Immobilizer: Passenger ID', 'Имобилайзер: идентификатор на пътник', 'STATUS', 'INFO'],
  ['69', 'Vehicle identification number', 'Идентификационен номер на автомобила', 'STATUS', 'INFO'],
  ['70', 'Diagnostics trouble codes', 'Диагностични кодове за неизправности', 'EDATA', 'WARNING'],
  ['71', 'Low RPM', 'Ниски обороти', 'ALARM', 'WARNING'],
  ['72', 'High RPM', 'Високи обороти', 'ALARM', 'WARNING'],
  ['73', 'Device added', 'Добавено устройство', 'STATUS', 'INFO'],
  ['74', 'Device removed', 'Премахнато устройство', 'ALARM', 'WARNING'],
  ['75', 'Motorcycle alarm: Garage mode', 'Аларма за мотоциклет: гаражен режим', 'STATUS', 'INFO'],
  ['76', 'Removal/Sabotage', 'Демонтаж/саботаж', 'ALARM', 'CRITICAL'],
  ['77', 'Immobilizer: Override mode', 'Имобилайзер: режим на ръчно управление', 'STATUS', 'INFO'],
  ['78', 'Normal RPM', 'Нормални обороти', 'STATUS', 'INFO'],
  ['79', 'Idle ended', 'Край на празния ход', 'STATUS', 'INFO'],
  ['80', 'Overtime', 'Превишено работно време', 'ALARM', 'WARNING'],
  ['81', 'Ignition off while moving', 'Изключен контакт по време на движение', 'ALARM', 'WARNING'],
  ['82', 'Driver assistance', 'Помощ за водача', 'STATUS', 'INFO'],
  ['83', 'Voltage in range', 'Напрежение в допустимите граници', 'STATUS', 'INFO'],
  ['84', 'Vibration detected', 'Засечена вибрация', 'ALARM', 'WARNING'],
  ['85', 'Hijack turned off', 'Защитата от отвличане е изключена', 'STATUS', 'INFO'],
  ['86', 'Hijack turned on', 'Защитата от отвличане е включена', 'STATUS', 'INFO'],
  ['87', 'Hijack warning', 'Предупреждение за отвличане', 'ALARM', 'WARNING'],
  ['88', 'Hijack detected', 'Засечено отвличане', 'ALARM', 'CRITICAL'],
  ['89', 'Service needed', 'Необходимо обслужване', 'EDATA', 'WARNING'],
  ['90', 'GNSS Jamming detected', 'Засечено заглушаване на GNSS', 'ALARM', 'CRITICAL'],
  ['91', 'GNSS Jamming ended', 'Край на заглушаването на GNSS', 'ALARM', 'INFO'],
  ['92', 'Low remote battery', 'Нисък заряд на дистанционното управление', 'ALARM', 'WARNING'],
  [
    '93',
    'Immobilizer: Forced disarm',
    'Имобилайзер: принудително деактивиране',
    'ALARM',
    'WARNING',
  ],
  ['94', 'SIM Lost', 'SIM картата е изгубена', 'ALARM', 'WARNING'],
  ['95', 'SIM detected', 'SIM картата е открита', 'ALARM', 'INFO'],
];

export const starlinkEvents = new Map(
  entries.map(([id, en, bg, category, severity]) => [id, { en, bg, category, severity }]),
);

// StarLink 02 diagnostic codes, not vehicle DTCs:
// docs/discocan/erm-resources/starlink-online-protocol/authenticated/pages/E2.md
// https://sweb.erm.co.il/protocol/?i=E2 (archived 2026-10-29).
const diagnosticCodes: ReadonlyMap<string, readonly [string, string]> = new Map([
  ['1', ['SIM card not inserted', 'SIM картата не е поставена']],
  ['2', ['Unable to register to network', 'Неуспешна регистрация в мрежата']],
  ['3', ['Unable to connect to data network', 'Няма връзка с мрежата за данни']],
  ['4', ['Unable to connect to server', 'Няма връзка със сървъра']],
  ['5', ['No communication with GNSS', 'Няма комуникация с GNSS']],
  ['6', ['Unable to send SMS', 'Неуспешно изпращане на SMS']],
  ['7', ['Keep-alive not received from server', 'Не е получен keep-alive от сървъра']],
  ['8', ['GNSS cannot find current location', 'GNSS не намира текущото местоположение']],
  ['9', ['Message logger is full', 'Паметта за съобщения е пълна']],
  ['10', ['Incoming SMS rejected (not from server)', 'Входящ SMS е отхвърлен (не е от сървъра)']],
  ['11', ['Powering off due to low backup battery', 'Изключване поради изтощена резервна батерия']],
  ['12', ['Too many eNet3 errors', 'Твърде много грешки в eNet3']],
  ['13', ['Too many eNet2 errors', 'Твърде много грешки в eNet2']],
  ['14', ['Global SMS daily limit reached', 'Достигнат е общият дневен лимит за SMS']],
  ['15', ['Server SMS daily limit reached', 'Достигнат е дневният лимит за SMS към сървъра']],
  ['16', ['Simple SMS daily limit reached', 'Достигнат е дневният лимит за Simple SMS']],
  ['17', ['Unwanted disconnection from server', 'Нежелано прекъсване на връзката със сървъра']],
  ['18', ['Unable to send data to server', 'Неуспешно изпращане на данни към сървъра']],
  ['19', ['Modem reset limit triggered', 'Модемът е рестартиран според лимита за рестартиране']],
  ['20', ['Cellular signal degradation', 'Влошен клетъчен сигнал']],
  ['21', ['GNSS entered garage mode', 'GNSS е влязъл в гаражен режим']],
  ['22', ['GNSS exited garage mode', 'GNSS е излязъл от гаражен режим']],
  ['23', ['Server authentication failed', 'Неуспешно удостоверяване пред сървъра']],
  ['24', ['System reset', 'Системата е рестартирана']],
  ['25', ['CAN odometer not received', 'Не е получен CAN километраж']],
  ['26', ['SIM refreshed', 'SIM картата е обновена']],
  ['27', ['Parameter corruption detected', 'Открити са повредени параметри']],
  ['28', ['Modem turned off because of no signal', 'Модемът е изключен поради липса на сигнал']],
  ['29', ['Modem turned back on', 'Модемът е включен отново']],
  ['30', ['Incoming SMS received', 'Получен е входящ SMS']],
  ['31', ['CAN baud rate detected automatically', 'Скоростта на CAN е разпозната автоматично']],
  ['32', ['Incoming call rejected', 'Входящото повикване е отхвърлено']],
  ['33', ['Network technology changed', 'Променена е мрежовата технология']],
  ['34', ['GNSS firmware update', 'Обновяване на фърмуера на GNSS']],
  ['35', ['SIM card detected', 'Открита е SIM карта']],
]);

export function eventName(eventId: string | null, fields: unknown, language: 'BG' | 'EN') {
  const entry = starlinkEvents.get(eventId ?? '');
  const name = (language === 'BG' ? entry?.bg : entry?.en) ?? null;
  if (
    name === null ||
    eventId !== '02' ||
    typeof fields !== 'object' ||
    fields === null ||
    !('extra' in fields)
  ) {
    return name;
  }
  const extra: unknown = fields.extra;
  if (!Array.isArray(extra) || typeof extra[0] !== 'string' || typeof extra[1] !== 'string') {
    return name;
  }
  const code = `${extra[0]},${extra[1]}`;
  const meaning = diagnosticCodes.get(extra[1])?.[language === 'BG' ? 1 : 0];
  return `${name}: ${meaning ? `${meaning} (${code})` : code}`;
}

export function eventClassification(eventId: string | null): {
  category: ErmEventCategory;
  severity: ErmEventSeverity;
} {
  const entry = starlinkEvents.get(eventId ?? '');
  return { category: entry?.category ?? 'OTHER', severity: entry?.severity ?? 'INFO' };
}

export function categoryEventIds(categories: readonly ErmEventCategory[]): string[] {
  return [...starlinkEvents]
    .filter(([, entry]) => categories.includes(entry.category))
    .map(([id]) => id);
}
