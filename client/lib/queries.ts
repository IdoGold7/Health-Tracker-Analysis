import { supabase } from './supabase';

/**
 * Base food_logs query with joined food names and per-100g macros.
 * Returns the query builder — callers chain their own filters
 * (.gte/.lt for date range, .eq/.single for one entry, .order, etc).
 */
export function foodLogsWithMacros() {
  return supabase
    .from('food_logs')
    .select(`
      id, grams, logged_at,
      user_foods!food_logs_user_food_id_fkey(name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g),
      public_foods!food_logs_public_food_id_fkey(name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    `);
}
