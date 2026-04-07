export type FoodFormState = {
  name: string;
  brand: string;
  kcal_per_100g: string;
  protein_per_100g: string;
  carbs_per_100g: string;
  fat_per_100g: string;
  unit_label: string;
  unit_grams: string;
};

export const EMPTY_FORM: FoodFormState = {
  name: '',
  brand: '',
  kcal_per_100g: '',
  protein_per_100g: '',
  carbs_per_100g: '',
  fat_per_100g: '',
  unit_label: '',
  unit_grams: '',
};

const MACRO_FIELDS: { key: keyof FoodFormState; label: string }[] = [
  { key: 'kcal_per_100g', label: 'Calories' },
  { key: 'protein_per_100g', label: 'Protein' },
  { key: 'carbs_per_100g', label: 'Carbs' },
  { key: 'fat_per_100g', label: 'Fat' },
];

export function validate(form: FoodFormState): string | null {
  if (!form.name.trim()) return 'Name is required.';

  for (const { key, label } of MACRO_FIELDS) {
    const raw = form[key];
    if (raw === '') return `${label} is required.`;
    if (isNaN(Number(raw))) return `${label} must be a number.`;
    if (Number(raw) < 0) return `${label} must be 0 or greater.`;
  }

  const hasLabel = form.unit_label.trim() !== '';
  const hasGrams = form.unit_grams.trim() !== '';
  if (hasLabel !== hasGrams) return 'Unit label and unit grams must both be set or both be empty.';
  if (hasGrams) {
    if (isNaN(Number(form.unit_grams))) return 'Unit grams must be a number.';
    if (Number(form.unit_grams) <= 0) return 'Unit grams must be greater than 0.';
  }

  return null;
}

export function buildPayload(form: FoodFormState) {
  const hasUnit = form.unit_label.trim() !== '';
  return {
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    kcal_per_100g: Number(form.kcal_per_100g),
    protein_per_100g: Number(form.protein_per_100g),
    carbs_per_100g: Number(form.carbs_per_100g),
    fat_per_100g: Number(form.fat_per_100g),
    unit_label: hasUnit ? form.unit_label.trim() : null,
    unit_grams: hasUnit ? Number(form.unit_grams) : null,
  };
}
