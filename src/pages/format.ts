const dayLong = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const dayOnly = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long' });
const weekdayShort = new Intl.DateTimeFormat('pt-PT', { weekday: 'short' });
const monthYear = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Reads "YYYY-MM-DD" as a local date, so the day never shifts with the time zone.
export function parseIsoDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// "sexta-feira, 2 de outubro"
export function formatDayLong(date: Date): string {
  return dayLong.format(date);
}

// "2 de outubro"
export function formatDay(date: Date): string {
  return dayOnly.format(date);
}

// "sex"
export function formatWeekdayShort(date: Date): string {
  return weekdayShort.format(date).replace('.', '');
}

// "Outubro de 2026"
export function formatMonthTitle(year: number, month0: number): string {
  return capitalise(monthYear.format(new Date(year, month0, 1)));
}

// "2 de out. de 2026", from an ISO datetime. Empty when the stored value is not a date.
export function formatShortDate(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return Number.isNaN(date.getTime()) ? '' : shortDate.format(date);
}

export function focusField(id: string): void {
  document.getElementById(id)?.focus();
}

// Focus that has to wait for a dialog to close: while a modal dialog is open,
// nothing outside it can take focus.
export function focusSoon(target: () => HTMLElement | null): void {
  window.setTimeout(() => target()?.focus(), 0);
}
