import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Button,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';

// --- Types ---

type FoodSource = 'user' | 'public';

type SearchResult = {
  id: string;
  source: FoodSource;
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit_label: string | null;
  unit_grams: number | null;
};

type QueuedItem = {
  key: string;
  food: SearchResult;
  amountDisplay: string; // what the user typed + context (e.g. "2 egg(s)" or "120g")
  grams: number;
};

// --- Search ---

async function searchFoods(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed}%`;

  const [userRes, publicRes] = await Promise.all([
    supabase
      .from('user_foods')
      .select('id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_label, unit_grams')
      .ilike('name', pattern)
      .order('name')
      .limit(10),
    supabase
      .from('public_foods')
      .select('id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_label, unit_grams')
      .ilike('name', pattern)
      .order('name')
      .limit(10),
  ]);

  const userFoods: SearchResult[] = (userRes.data ?? []).map((f) => ({
    ...f,
    source: 'user' as FoodSource,
  }));

  const publicFoods: SearchResult[] = (publicRes.data ?? []).map((f) => ({
    ...f,
    source: 'public' as FoodSource,
  }));

  // User foods first, then public
  return [...userFoods, ...publicFoods];
}

// --- Component ---

export default function LogFood() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [inputMode, setInputMode] = useState<'units' | 'grams'>('units');
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState('');

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const data = await searchFoods(text);
    setResults(data);
  }

  function handleSelectFood(food: SearchResult) {
    setSelectedFood(food);
    setAmountInput('');
    setInputMode(food.unit_label ? 'units' : 'grams');
    setResults([]);
    setSearchQuery('');
  }

  const hasUnit = selectedFood?.unit_label != null;
  const amountLabel = hasUnit && inputMode === 'units'
    ? `Amount (${selectedFood!.unit_label}s)`
    : 'Amount (grams)';

  function computeGrams(): number | null {
    if (!selectedFood) return null;
    const num = Number(amountInput);
    if (isNaN(num) || num <= 0) return null;
    if (hasUnit && inputMode === 'units') {
      return Math.round(num * selectedFood.unit_grams! * 10) / 10;
    }
    return num;
  }

  const gramsValue = computeGrams();

  function handleAddToQueue() {
    if (!selectedFood) return;
    if (gramsValue === null) {
      Alert.alert('Invalid amount', 'Enter a number greater than 0.');
      return;
    }

    const amountDisplay = hasUnit && inputMode === 'units'
      ? `${amountInput} ${selectedFood.unit_label}(s)`
      : `${gramsValue}g`;

    setQueue((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        food: selectedFood,
        amountDisplay,
        grams: gramsValue,
      },
    ]);
    setSelectedFood(null);
    setAmountInput('');
  }

  function handleRemoveFromQueue(key: string) {
    setQueue((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleSubmit() {
    if (queue.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    // Determine logged_at
    let loggedAt: string;
    if (manualTime.trim()) {
      const parsed = new Date(manualTime.trim());
      if (isNaN(parsed.getTime())) {
        setSubmitError('Invalid date/time format.');
        setSubmitting(false);
        return;
      }
      loggedAt = parsed.toISOString();
    } else {
      loggedAt = new Date().toISOString();
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError('Not signed in.');
      setSubmitting(false);
      return;
    }

    // Single multi-row insert
    const rows = queue.map((item) => ({
      user_id: user.id,
      user_food_id: item.food.source === 'user' ? item.food.id : null,
      public_food_id: item.food.source === 'public' ? item.food.id : null,
      grams: item.grams,
      logged_at: loggedAt,
    }));

    const { error } = await supabase.from('food_logs').insert(rows);

    if (error) {
      setSubmitError(error.message);
    } else {
      setQueue([]);
      setManualTime('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    }

    setSubmitting(false);
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Log Food</Text>

      {/* Search */}
      <TextInput
        placeholder="Search foods..."
        value={searchQuery}
        onChangeText={handleSearch}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />

      {/* Search Results */}
      {results.length > 0 && (
        <View style={{ maxHeight: 200, borderWidth: 1, borderColor: '#ccc', marginBottom: 8 }}>
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.source}-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectFood(item)}
                style={{ padding: 10, borderBottomWidth: 1, borderColor: '#eee' }}
              >
                <Text>
                  {item.name}{item.brand ? ` (${item.brand})` : ''}
                  <Text style={{ color: '#888' }}> [{item.source}]</Text>
                </Text>
                <Text style={{ color: '#555', fontSize: 12 }}>
                  {item.kcal_per_100g} kcal/100g
                  {item.unit_label ? ` | 1 ${item.unit_label} = ${item.unit_grams}g` : ''}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Selected food — amount input placeholder for Checkpoint 2 */}
      {selectedFood && (
        <View style={{ borderWidth: 1, borderColor: '#4CAF50', padding: 12, borderRadius: 4 }}>
          <Text style={{ fontWeight: 'bold' }}>
            {selectedFood.name}{selectedFood.brand ? ` (${selectedFood.brand})` : ''}
            <Text style={{ color: '#888' }}> [{selectedFood.source}]</Text>
          </Text>
          <Text style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
            id: {selectedFood.id} | source: {selectedFood.source}
          </Text>
          {hasUnit && (
            <Button
              title={inputMode === 'units' ? 'Switch to grams' : `Switch to ${selectedFood!.unit_label}s`}
              onPress={() => {
                setInputMode(inputMode === 'units' ? 'grams' : 'units');
                setAmountInput('');
              }}
            />
          )}
          <TextInput
            placeholder={amountLabel}
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="numeric"
            style={{ borderWidth: 1, padding: 8, marginTop: 8 }}
          />
          {amountInput !== '' && gramsValue !== null && hasUnit && inputMode === 'units' && (
            <Text style={{ color: '#555', marginTop: 4 }}>
              = {gramsValue}g
            </Text>
          )}
          {amountInput !== '' && gramsValue === null && (
            <Text style={{ color: 'red', marginTop: 4 }}>
              Enter a number greater than 0
            </Text>
          )}
          <View style={{ marginTop: 8 }}>
            <Button title="+ Add to Queue" onPress={handleAddToQueue} />
          </View>
        </View>
      )}
      {/* Queue */}
      {queue.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Queued Items ({queue.length}):</Text>
          {queue.map((item) => (
            <View key={item.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#eee' }}>
              <View style={{ flex: 1 }}>
                <Text>{item.food.name} <Text style={{ color: '#888' }}>[{item.food.source}]</Text></Text>
                <Text style={{ color: '#555', fontSize: 12 }}>
                  {item.amountDisplay} = {item.grams}g
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveFromQueue(item.key)}>
                <Text style={{ color: 'red', fontSize: 18, paddingHorizontal: 8 }}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Manual time override */}
      <TextInput
        placeholder="Logged at (optional, e.g. 2026-04-10T08:30)"
        value={manualTime}
        onChangeText={setManualTime}
        style={{ borderWidth: 1, padding: 8, marginTop: 12 }}
      />

      {/* Submit */}
      <TouchableOpacity
        style={{
          marginTop: 12,
          backgroundColor: queue.length === 0 || submitting ? '#999' : '#2196F3',
          padding: 12,
          borderRadius: 4,
          alignItems: 'center',
        }}
        onPress={handleSubmit}
        activeOpacity={queue.length === 0 || submitting ? 1 : 0.7}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>
          {submitting ? 'Submitting...' : 'Submit Log'}
        </Text>
      </TouchableOpacity>
      {submitError && (
        <Text style={{ color: 'red', marginTop: 8 }}>{submitError}</Text>
      )}
      {submitSuccess && (
        <Text style={{ color: 'green', marginTop: 8 }}>Logged successfully!</Text>
      )}
    </View>
  );
}
