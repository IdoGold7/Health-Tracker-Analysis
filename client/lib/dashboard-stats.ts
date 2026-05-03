import { DailyMacros, BodyMetricsDataPoint } from './dashboard-queries';

export type SummaryStats = {
  avg_kcal: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
  weight_delta_kg: number | null;
  current_bmi: number | null;
  days_logged: number;
  total_days_in_range: number;
};

export type AdherenceCounts = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const MS_PER_DAY = 86_400_000;

export function computeSummaryStats(
  dailyMacros: DailyMacros[],
  bodyMetrics: BodyMetricsDataPoint[],
  latestWeightKg: number | null,
  heightM: number | null,
  totalDaysInRange: number
): SummaryStats {
  const n = dailyMacros.length;

  let avg_kcal: number | null = null;
  let avg_protein_g: number | null = null;
  let avg_carbs_g: number | null = null;
  let avg_fat_g: number | null = null;

  if (n > 0) {
    let sumKcal = 0;
    let sumProtein = 0;
    let sumCarbs = 0;
    let sumFat = 0;
    for (const d of dailyMacros) {
      sumKcal += d.kcal;
      sumProtein += d.protein_g;
      sumCarbs += d.carbs_g;
      sumFat += d.fat_g;
    }
    avg_kcal = Math.round(sumKcal / n);
    avg_protein_g = Math.round((sumProtein / n) * 10) / 10;
    avg_carbs_g = Math.round((sumCarbs / n) * 10) / 10;
    avg_fat_g = Math.round((sumFat / n) * 10) / 10;
  }

  const weighIns = bodyMetrics.filter((b) => b.weight_kg != null);
  let weight_delta_kg: number | null = null;
  if (weighIns.length >= 2) {
    const first = weighIns[0].weight_kg!;
    const last = weighIns[weighIns.length - 1].weight_kg!;
    weight_delta_kg = Math.round((last - first) * 10) / 10;
  }

  let current_bmi: number | null = null;
  if (latestWeightKg != null && heightM != null && latestWeightKg > 0 && heightM > 0) {
    current_bmi = Math.round((latestWeightKg / (heightM * heightM)) * 10) / 10;
  }

  return {
    avg_kcal,
    avg_protein_g,
    avg_carbs_g,
    avg_fat_g,
    weight_delta_kg,
    current_bmi,
    days_logged: n,
    total_days_in_range: totalDaysInRange,
  };
}

export function computeAdherence(
  dailyMacros: DailyMacros[],
  targets: {
    target_kcal: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
  }
): AdherenceCounts {
  const kcal =
    targets.target_kcal != null
      ? dailyMacros.filter((d) => d.kcal <= targets.target_kcal!).length
      : null;
  const protein =
    targets.target_protein_g != null
      ? dailyMacros.filter((d) => d.protein_g >= targets.target_protein_g!).length
      : null;
  const carbs =
    targets.target_carbs_g != null
      ? dailyMacros.filter((d) => d.carbs_g <= targets.target_carbs_g!).length
      : null;
  const fat =
    targets.target_fat_g != null
      ? dailyMacros.filter((d) => d.fat_g <= targets.target_fat_g!).length
      : null;

  return { kcal, protein, carbs, fat };
}

export function calcTotalDaysInRange(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
}
