const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

// Weekday index with Monday as 0 and Sunday as 6.
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function monthGrid(year: number, month0: number): (string | null)[] {
  const grid: (string | null)[] = Array.from({ length: mondayIndex(new Date(year, month0, 1)) }, () => null);
  for (let day = 1; day <= daysInMonth(year, month0); day++) grid.push(isoDate(new Date(year, month0, day)));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}
