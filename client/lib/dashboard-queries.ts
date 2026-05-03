import { SupabaseClient } from '@supabase/supabase-js';
import { localDateStr, calcNavyBodyFat } from './body-metrics-helpers';

export type DailyMacros = {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  log_count: number;
};

export async function getDashboardFoodLogs(
  supabase: SupabaseClient,
  start: Date,
  end: Date
): Promise<DailyMacros[]> {
  try {
    const { data, error } = await supabase
      .from('food_logs')
      .select(
        'logged_at, grams, user_foods!food_logs_user_food_id_fkey(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g), public_foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)'
      )
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString())
      .order('logged_at', { ascending: true });

    if (error) {
      console.error('getDashboardFoodLogs error:', error);
      return [];
    }
    if (!data || data.length === 0) return [];

    const dayMap = new Map<string, { kcal: number; protein_g: number; carbs_g: number; fat_g: number; log_count: number }>();

    for (const row of data) {
      const source = row.user_foods ?? row.public_foods;
      const food = (Array.isArray(source) ? source[0] : source) as {
        kcal_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
      };
      const g = Number(row.grams);
      const rawKcal = (Number(food.kcal_per_100g) * g) / 100;
      const rawProtein = (Number(food.protein_per_100g) * g) / 100;
      const rawCarbs = (Number(food.carbs_per_100g) * g) / 100;
      const rawFat = (Number(food.fat_per_100g) * g) / 100;

      const day = localDateStr(row.logged_at);
      const entry = dayMap.get(day);
      if (entry) {
        entry.kcal += rawKcal;
        entry.protein_g += rawProtein;
        entry.carbs_g += rawCarbs;
        entry.fat_g += rawFat;
        entry.log_count += 1;
      } else {
        dayMap.set(day, { kcal: rawKcal, protein_g: rawProtein, carbs_g: rawCarbs, fat_g: rawFat, log_count: 1 });
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        kcal: round1(v.kcal),
        protein_g: round1(v.protein_g),
        carbs_g: round1(v.carbs_g),
        fat_g: round1(v.fat_g),
        log_count: v.log_count,
      }));
  } catch (e) {
    console.error('getDashboardFoodLogs exception:', e);
    return [];
  }
}

export type BodyMetricsDataPoint = {
  date: string;
  logged_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  neck_cm: number | null;
  waist_cm: number | null;
  forearm_cm: number | null;
  navy_bf_pct: number | null;
};

export async function getDashboardBodyMetrics(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  height_m: number | null
): Promise<BodyMetricsDataPoint[]> {
  try {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('logged_at, weight_kg, body_fat_pct, neck_cm, waist_cm, forearm_cm')
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString())
      .order('logged_at', { ascending: true });

    if (error) {
      console.error('getDashboardBodyMetrics error:', error);
      return [];
    }
    if (!data || data.length === 0) return [];

    return data.map((row) => {
      const neck = row.neck_cm != null ? Number(row.neck_cm) : null;
      const waist = row.waist_cm != null ? Number(row.waist_cm) : null;

      return {
        date: localDateStr(row.logged_at),
        logged_at: row.logged_at,
        weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
        body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
        neck_cm: neck,
        waist_cm: waist,
        forearm_cm: row.forearm_cm != null ? Number(row.forearm_cm) : null,
        navy_bf_pct: calcNavyBodyFat(neck, waist, height_m),
      };
    });
  } catch (e) {
    console.error('getDashboardBodyMetrics exception:', e);
    return [];
  }
}

export async function getLatestWeight(
  supabase: SupabaseClient
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('weight_kg')
      .not('weight_kg', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('getLatestWeight error:', error);
      return null;
    }
    return data?.weight_kg != null ? Number(data.weight_kg) : null;
  } catch (e) {
    console.error('getLatestWeight exception:', e);
    return null;
  }
}
