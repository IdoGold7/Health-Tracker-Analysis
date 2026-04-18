/** Format today's date as YYYY-MM-DD in local time. */
export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Parse a non-empty string to a positive number (> 0). Returns null for empty, NaN for invalid. */
export function parsePositive(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (isNaN(num)) return NaN as any;
  if (num <= 0) return NaN as any;
  return num;
}

/** Parse body fat %. Returns null for empty, NaN for invalid/out-of-range. */
export function parseBodyFat(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (isNaN(num)) return NaN as any;
  if (num < 0 || num > 100) return NaN as any;
  return num;
}

/** Today → now(); past date → local noon of that date. */
export function buildLoggedAt(selectedDate: string): string {
  const today = todayStr();
  if (selectedDate === today) {
    return new Date().toISOString();
  }
  return new Date(`${selectedDate}T12:00:00`).toISOString();
}
