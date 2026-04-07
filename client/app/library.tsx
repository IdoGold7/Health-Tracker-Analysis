import { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

type UserFood = {
  id: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit_label: string | null;
  unit_grams: number | null;
};

export default function Library() {
  const [foods, setFoods] = useState<UserFood[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchFoods();
    }, [])
  );

  async function fetchFoods() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('user_foods')
      .select('id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_label, unit_grams')
      .order('name', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setFoods(data ?? []);
    }
    setLoading(false);
  }

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Button title="Add Food" onPress={() => router.push('/add-food')} />
      <TextInput
        placeholder="Search by name"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 8, marginVertical: 12 }}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/food/${item.id}`)}
            style={{ paddingVertical: 10, borderBottomWidth: 1 }}
          >
            <Text>{item.name}{item.brand ? ` (${item.brand})` : ''}</Text>
            <Text style={{ color: '#555' }}>
              {item.kcal_per_100g} kcal · P {item.protein_per_100g}g · C {item.carbs_per_100g}g · F {item.fat_per_100g}g
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No foods found.</Text>}
      />
    </View>
  );
}
