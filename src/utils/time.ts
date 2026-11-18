export const ASTANA_TZ = 'Asia/Almaty';
export const ASTANA_CENTER: [number, number] = [51.128, 71.430];

export const ASTANA_BOUNDS = {
  minLat: 51.01,
  maxLat: 51.28,
  minLng: 71.25,
  maxLng: 71.62,
};

export interface AstanaDistrict {
  id: string;
  name_ru: string;
  name_kz: string;
  lat: number;
  lng: number;
}

export const ASTANA_DISTRICTS: AstanaDistrict[] = [
  { id: 'esil', name_ru: 'Есильский (Левый берег / EXPO)', name_kz: 'Есіл ауданы (Сол жағалау / EXPO)', lat: 51.090, lng: 71.418 },
  { id: 'nura', name_ru: 'Нура (Байтерек / Хан Шатыр)', name_kz: 'Нұра ауданы (Бәйтерек / Хан Шатыр)', lat: 51.128, lng: 71.430 },
  { id: 'saryarka', name_ru: 'Сарыарка (Старый центр / Набережная)', name_kz: 'Сарыарқа ауданы (Жағалау)', lat: 51.162, lng: 71.422 },
  { id: 'almaty', name_ru: 'Алматы (Парк Жастар / Дворец Мира)', name_kz: 'Алматы ауданы (Жастар саябағы)', lat: 51.132, lng: 71.468 },
  { id: 'baikonur', name_ru: 'Байконур (Астана Арена / Проспекты)', name_kz: 'Байқоңыр ауданы', lat: 51.158, lng: 71.455 },
];

export function isWithinAstana(lat: number, lng: number): boolean {
  return (
    lat >= ASTANA_BOUNDS.minLat &&
    lat <= ASTANA_BOUNDS.maxLat &&
    lng >= ASTANA_BOUNDS.minLng &&
    lng <= ASTANA_BOUNDS.maxLng
  );
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function getAlmatyDateParts(date: Date | string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sun, 6 = Sat
  dateKey: string; // YYYY-MM-DD
} {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASTANA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wkMap[get('weekday')] ?? 0;
  const dateKey = `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, weekday, dateKey };
}

export function formatAlmatyTime(date: Date | string): string {
  const { hour, minute } = getAlmatyDateParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatAlmatyDateTime(date: Date | string, lang: 'ru' | 'kz' = 'ru'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nowParts = getAlmatyDateParts(new Date());
  const targetParts = getAlmatyDateParts(d);
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowParts = getAlmatyDateParts(tomorrow);
  const timeStr = formatAlmatyTime(d);

  if (targetParts.dateKey === nowParts.dateKey) {
    return `${lang === 'kz' ? 'Бүгін' : 'Сегодня'}, ${timeStr}`;
  }
  if (targetParts.dateKey === tomorrowParts.dateKey) {
    return `${lang === 'kz' ? 'Ертең' : 'Завтра'}, ${timeStr}`;
  }

  const monthsRu = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const monthsKz = ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'];
  const mName = (lang === 'kz' ? monthsKz : monthsRu)[targetParts.month - 1] || '';
  return `${targetParts.day} ${mName}, ${timeStr}`;
}

export function formatAlmatyFullStamp(date: Date | string): string {
  const p = getAlmatyDateParts(date);
  return `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}.${p.year} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function isEventLiveNow(startsAt: string, endsAt: string, nowMs = Date.now()): boolean {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  return nowMs >= s && nowMs <= e;
}

export function isEventWithinWindowHours(startsAt: string, endsAt: string, hours = 3, nowMs = Date.now()): boolean {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  const windowEnd = nowMs + hours * 3600 * 1000;
  // Live now or starting within the next 3 hours and not yet ended
  return e >= nowMs && s <= windowEnd;
}

export function matchesTimeline(startsAt: string, timeline: 'all' | 'today' | 'tomorrow' | 'weekend'): boolean {
  if (timeline === 'all') return true;
  const now = new Date();
  const todayKey = getAlmatyDateParts(now).dateKey;
  const tomorrowKey = getAlmatyDateParts(new Date(now.getTime() + 86400000)).dateKey;
  const evParts = getAlmatyDateParts(startsAt);

  if (timeline === 'today') return evParts.dateKey === todayKey;
  if (timeline === 'tomorrow') return evParts.dateKey === tomorrowKey;
  if (timeline === 'weekend') {
    const startMs = new Date(startsAt).getTime();
    const diffDays = (startMs - now.getTime()) / 86400000;
    return diffDays >= -0.5 && diffDays <= 7 && (evParts.weekday === 0 || evParts.weekday === 6);
  }
  return true;
}

export function toAlmatyInputValues(isoString: string): { date: string; startTime: string; endTime?: string } {
  const p = getAlmatyDateParts(isoString);
  return {
    date: p.dateKey,
    startTime: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
  };
}

export function buildAlmatyIso(dateStr: string, timeStr: string): string {
  // Asia/Almaty is UTC+05:00 permanently
  return `${dateStr}T${timeStr}:00+05:00`;
}
