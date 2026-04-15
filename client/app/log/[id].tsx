import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator, Button, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { foodLogsWithMacros } from '../../lib/queries';

type LogDetail = {
  food_name: string;
  grams: number;
  logged_at: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export default function LogDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editGrams, setEditGrams] = useState('');
  const [editLoggedAt, setEditLoggedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      if (!id) {
        setError('Invalid log entry.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await foodLogsWithMacros()
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Log entry not found.');
        setLoading(false);
        return;
      }

      const row = data as any;
      const food = row.user_foods ?? row.public_foods;
      const grams = Number(row.grams);

      setEntry({
        food_name: food.name,
        grams,
        logged_at: row.logged_at,
        kcal: grams * Number(food.kcal_per_100g) / 100,
        protein_g: grams * Number(food.protein_per_100g) / 100,
        carbs_g: grams * Number(food.carbs_per_100g) / 100,
        fat_g: grams * Number(food.fat_per_100g) / 100,
      });
      setLoading(false);
    }

    load();
  }, [id]);

  function startEdit() {
    if (!entry) return;
    setEditGrams(String(entry.grams));
    setEditLoggedAt(entry.logged_at);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    const gramsValue = parseFloat(editGrams);
    if (isNaN(gramsValue) || gramsValue <= 0) {
      setSaveError('Grams must be greater than 0.');
      return;
    }

    const parsed = new Date(editLoggedAt.trim());
    if (isNaN(parsed.getTime())) {
      setSaveError('Invalid date/time format.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const { error: updateError } = await supabase
      .from('food_logs')
      .update({ grams: gramsValue, logged_at: parsed.toISOString() })
      .eq('id', id!);

    if (updateError) {
      setSaveError(updateError.message);
      setSaving(false);
      return;
    }

    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setSaveError(null);

          const { error: deleteError } = await supabase
            .from('food_logs')
            .delete()
            .eq('id', id!);

          if (deleteError) {
            setSaveError(deleteError.message);
            setSaving(false);
            return;
          }

          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !entry) {
    return (
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ color: 'red', fontSize: 16 }}>{error ?? 'Log entry not found.'}</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const loggedDate = new Date(entry.logged_at);

  return (
    <ScrollView>
      <View style={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold' }}>{entry.food_name}</Text>

        <View style={{ gap: 8 }}>
          {editing ? (
            <>
              <Text style={{ fontSize: 14, color: '#555' }}>Grams</Text>
              <TextInput
                value={editGrams}
                onChangeText={setEditGrams}
                keyboardType="numeric"
                style={{ borderWidth: 1, padding: 8, fontSize: 16 }}
              />
              <Text style={{ fontSize: 14, color: '#555' }}>Logged at</Text>
              <TextInput
                value={editLoggedAt}
                onChangeText={setEditLoggedAt}
                placeholder="e.g. 2026-04-10T08:30"
                style={{ borderWidth: 1, padding: 8, fontSize: 16 }}
              />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 16 }}>Grams: {entry.grams}g</Text>
              <Text style={{ fontSize: 16 }}>
                Logged at: {loggedDate.toLocaleDateString()} {loggedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </>
          )}
        </View>

        <View style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4, gap: 4 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Macros</Text>
          <Text>{Math.round(entry.kcal)} kcal</Text>
          <Text>Protein: {Math.round(entry.protein_g * 10) / 10}g</Text>
          <Text>Carbs: {Math.round(entry.carbs_g * 10) / 10}g</Text>
          <Text>Fat: {Math.round(entry.fat_g * 10) / 10}g</Text>
        </View>

        {saveError && <Text style={{ color: 'red' }}>{saveError}</Text>}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {editing ? (
            <>
              <View style={{ flex: 1 }}>
                <Button title="Save" onPress={handleSave} disabled={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" onPress={cancelEdit} disabled={saving} color="#888" />
              </View>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Button title="Edit" onPress={startEdit} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Delete" onPress={handleDelete} disabled={saving} color="red" />
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
