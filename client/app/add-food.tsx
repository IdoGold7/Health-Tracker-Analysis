import { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { FoodFormState, EMPTY_FORM, validate, buildPayload } from '../lib/foodForm';

const FIELDS: { key: keyof FoodFormState; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand (optional)' },
  { key: 'kcal_per_100g', label: 'Calories per 100g', numeric: true },
  { key: 'protein_per_100g', label: 'Protein per 100g (g)', numeric: true },
  { key: 'carbs_per_100g', label: 'Carbs per 100g (g)', numeric: true },
  { key: 'fat_per_100g', label: 'Fat per 100g (g)', numeric: true },
  { key: 'unit_label', label: 'Unit label (optional, e.g. egg)' },
  { key: 'unit_grams', label: 'Unit grams (optional, e.g. 60)', numeric: true },
];

export default function AddFood() {
  const [form, setForm] = useState<FoodFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof FoodFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('user_foods').insert({ ...buildPayload(form), user_id: user!.id });
    setSaving(false);

    if (error) {
      setError(error.message);
    } else {
      router.back();
    }
  }

  return (
    <ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        {FIELDS.map(({ key, label, numeric }) => (
          <View key={key}>
            <Text>{label}</Text>
            <TextInput
              value={form[key]}
              onChangeText={(v) => set(key, v)}
              keyboardType={numeric ? 'decimal-pad' : 'default'}
              autoCapitalize="none"
              style={{ borderWidth: 1, padding: 8 }}
            />
          </View>
        ))}
        {error && <Text style={{ color: 'red' }}>{error}</Text>}
        <Button title={saving ? 'Saving…' : 'Save'} onPress={submit} disabled={saving} />
      </View>
    </ScrollView>
  );
}
