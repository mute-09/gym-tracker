export function formatNumber(value: number): string {
  return String(value);
}

export function weightLabel(value: number | null): string {
  return value === null ? '-' : `${formatNumber(value)} kg`;
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function daysLabel(daysAgo: number | null): string {
  if (daysAgo === null) return 'Belum ada sesi';
  if (daysAgo === 0) return 'Hari ini';
  if (daysAgo === 1) return '1 hari lalu';
  return `${daysAgo} hari lalu`;
}

export function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
