import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { FoodFormState, validate, buildPayload } from '../../lib/foodForm';

type UserFood = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit_label: string | null;
  unit_grams: number | null;
  source_public_food_id: string | null;
  created_at: string;
  updated_at: string;
};

const EDITABLE_FIELDS: { key: keyof FoodFormState; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'kcal_per_100g', label: 'Calories per 100g', numeric: true },
  { key: 'protein_per_100g', label: 'Protein per 100g (g)', numeric: true },
  { key: 'carbs_per_100g', label: 'Carbs per 100g (g)', numeric: true },
  { key: 'fat_per_100g', label: 'Fat per 100g (g)', numeric: true },
  { key: 'unit_label', label: 'Unit label' },
  { key: 'unit_grams', label: 'Unit grams', numeric: true },
];

function foodToForm(food: UserFood): FoodFormState {
  return {
    name: food.name,
    brand: food.brand ?? '',
    kcal_per_100g: String(food.kcal_per_100g),
    protein_per_100g: String(food.protein_per_100g),
    carbs_per_100g: String(food.carbs_per_100g),
    fat_per_100g: String(food.fat_per_100g),
    unit_label: food.unit_label ?? '',
    unit_grams: food.unit_grams != null ? String(food.unit_grams) : '',
  };
}

export default function FoodDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [food, setFood] = useState<UserFood | null>(null);
  const [form, setForm] = useState<FoodFormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFood();
  }, [id]);

  async function fetchFood() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_foods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      setError(error.message);
    } else {
      setFood(data);
      setForm(foodToForm(data));
    }
    setLoading(false);
  }

  function set(key: keyof FoodFormState, value: string) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function save() {
    if (!form) return;
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('user_foods')
      .update(buildPayload(form))
      .eq('id', id);
    setSaving(false);

    if (error) {
      setError(error.message);
    } else {
      setEditing(false);
      await fetchFood();
    }
  }

  function cancelEdit() {
    if (food) setForm(foodToForm(food));
    setError(null);
    setEditing(false);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Food',
      `Delete "${food?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteFood },
      ]
    );
  }

  async function deleteFood() {
    setError(null);
    const { error } = await supabase.from('user_foods').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        setError('This food cannot be deleted because it has been logged. Remove the logs first.');
      } else {
        setError(error.message);
      }
    } else {
      router.back();
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!food || !form) return <Text style={{ padding: 16 }}>Food not found.</Text>;

  return (
    <ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        {editing ? (
          <>
            {EDITABLE_FIELDS.map(({ key, label, numeric }) => (
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
            <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
            <Button title="Cancel" onPress={cancelEdit} />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{food.name}</Text>
            {food.brand && <Text>Brand: {food.brand}</Text>}
            <Text>Calories: {food.kcal_per_100g} per 100g</Text>
            <Text>Protein: {food.protein_per_100g}g per 100g</Text>
            <Text>Carbs: {food.carbs_per_100g}g per 100g</Text>
            <Text>Fat: {food.fat_per_100g}g per 100g</Text>
            {food.unit_label && <Text>Unit: {food.unit_label} = {food.unit_grams}g</Text>}
            <Text style={{ color: '#888', fontSize: 12 }}>Created: {food.created_at}</Text>
            {error && <Text style={{ color: 'red' }}>{error}</Text>}
            <Button title="Edit" onPress={() => setEditing(true)} />
            <Button title="Delete" color="red" onPress={confirmDelete} />
          </>
        )}
      </View>
    </ScrollView>
  );
}
