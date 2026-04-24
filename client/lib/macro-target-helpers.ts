/**
 * Compute macro targets from kcal target and weight.
 * Returns { protein_g, carbs_g, fat_g } rounded to integers,
 * or null if either input is missing/invalid.
 */
export function calcMacroTargets(
  target_kcal: number | null,
  weight_kg: number | null
): { protein_g: number; carbs_g: number; fat_g: number } | null {
  if (target_kcal === null || !Number.isFinite(target_kcal) || target_kcal <= 0) {
    return null;
  }
  if (weight_kg === null || !Number.isFinite(weight_kg) || weight_kg <= 0) {
    return null;
  }

  const protein_g = 2 * weight_kg;
  const protein_kcal = protein_g * 4;
  const remaining_kcal = target_kcal - protein_kcal;

  if (remaining_kcal < 0) {
    return null;
  }

  const carbs_g = (remaining_kcal * (2 / 3)) / 4;
  const fat_g = (remaining_kcal * (1 / 3)) / 9;

  return {
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
  };
}
