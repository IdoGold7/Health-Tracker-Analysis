import { supabase } from './supabase';

export type BodyMetricsSummary = {
  id: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  neck_cm: number | null;
  waist_cm: number | null;
  forearm_cm: number | null;
  logged_at: string;
};

/**
 * Return the most recent body_metrics row on or before `selectedDate`.
 * Filters `logged_at < next_day_start` (exclusive upper bound).
 * Returns null if no entry exists at or before the selected date.
 */
export async function fetchLatestBodyMetricsAsOf(
  selectedDate: string
): Promise<BodyMetricsSummary | null> {
  const nextDayStart = new Date(`${selectedDate}T00:00:00`);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  const { data, error } = await supabase
    .from('body_metrics')
    .select('id, weight_kg, body_fat_pct, neck_cm, waist_cm, forearm_cm, logged_at')
    .lt('logged_at', nextDayStart.toISOString())
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    weight_kg: data.weight_kg != null ? Number(data.weight_kg) : null,
    body_fat_pct: data.body_fat_pct != null ? Number(data.body_fat_pct) : null,
    neck_cm: data.neck_cm != null ? Number(data.neck_cm) : null,
    waist_cm: data.waist_cm != null ? Number(data.waist_cm) : null,
    forearm_cm: data.forearm_cm != null ? Number(data.forearm_cm) : null,
    logged_at: data.logged_at,
  };
}

/** Format today's date as YYYY-MM-DD in local time. */
export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Format an ISO timestamp as YYYY-MM-DD in local time. */
export function localDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/**
 * US Navy body fat % estimate (male formula).
 * Returns null if any input is missing or invalid.
 */
export function calcNavyBodyFat(
  neck_cm: number | null,
  waist_cm: number | null,
  height_m: number | null
): number | null {
  if (neck_cm === null || waist_cm === null || height_m === null) return null;
  if (neck_cm <= 0 || waist_cm <= 0 || height_m <= 0) return null;
  if (waist_cm <= neck_cm) return null;
  const height_cm = height_m * 100;
  const result =
    495 /
      (1.0324 -
        0.19077 * Math.log10(waist_cm - neck_cm) +
        0.15456 * Math.log10(height_cm)) -
    450;
  if (!Number.isFinite(result)) return null;
  return Math.round(result * 10) / 10;
}

/** Today → now(); past date → local noon of that date. */
export function buildLoggedAt(selectedDate: string): string {
  const today = todayStr();
  if (selectedDate === today) {
    return new Date().toISOString();
  }
  return new Date(`${selectedDate}T12:00:00`).toISOString();
}
