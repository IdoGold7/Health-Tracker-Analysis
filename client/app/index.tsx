import { useState, useEffect, useCallback, useRef } from 'react';
import { View, TextInput, Button, Text, ScrollView, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { foodLogsWithMacros } from '../lib/queries';
import { Session } from '@supabase/supabase-js';

// --- Types ---

type DailyLogEntry = {
  id: string;
  logged_at: string;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

// --- Query ---

function getLocalDayBounds(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return { start: start.toISOString(), end: next.toISOString() };
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function fetchDailyLogs(dateStr: string): Promise<DailyLogEntry[]> {
  const { start, end } = getLocalDayBounds(dateStr);

  const { data, error } = await foodLogsWithMacros()
    .gte('logged_at', start)
    .lt('logged_at', end)
    .order('logged_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const food = row.user_foods ?? row.public_foods;
    const grams = Number(row.grams);
    return {
      id: row.id,
      logged_at: row.logged_at,
      food_name: food.name,
      grams,
      kcal: grams * Number(food.kcal_per_100g) / 100,
      protein_g: grams * Number(food.protein_per_100g) / 100,
      carbs_g: grams * Number(food.carbs_per_100g) / 100,
      fat_g: grams * Number(food.fat_per_100g) / 100,
    };
  });
}

export default function Index() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    // Restore session from AsyncStorage on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Keep session state in sync with auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadLogs = useCallback(async () => {
    if (!session) return;
    setLoadingLogs(true);
    setLogError(null);
    setEntries([]);
    try {
      const data = await fetchDailyLogs(selectedDate);
      setEntries(data);
    } catch (err: any) {
      console.error('Failed to fetch daily logs:', err);
      setLogError(err.message ?? 'Failed to load logs.');
      setEntries([]);
    }
    setLoadingLogs(false);
  }, [session, selectedDate]);

  const hasMounted = useRef(false);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useFocusEffect(
    useCallback(() => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      loadLogs();
    }, [loadLogs])
  );

  async function signIn() {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSession(data.session);
    }
  }

  return (
    <ScrollView>
      <View style={{ padding: 20, gap: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ borderWidth: 1, padding: 8 }}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{ borderWidth: 1, padding: 8 }}
        />
        <Button title="Sign In" onPress={signIn} />
        {error && <Text style={{ color: 'red' }}>{error}</Text>}
        {session && <Button title="Go to Library" onPress={() => router.push('/library')} />}
        {session && <Button title="Log Food" onPress={() => router.push('/log-food')} />}
        {session && <Button title="Body Metrics" onPress={() => router.push('/body-metrics')} />}
        {session && <Button title="Sign Out" onPress={() => supabase.auth.signOut()} />}

        {/* Daily macro display */}
        {session && (
          <View style={{ marginTop: 16 }}>
            {/* Date picker */}
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ backgroundColor: '#f0f0f0', padding: 10, borderRadius: 4, marginBottom: 8 }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{selectedDate}  ▼</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={new Date(`${selectedDate}T12:00:00`)}
                mode="date"
                maximumDate={new Date()}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (event.type === 'set' && date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setSelectedDate(`${y}-${m}-${d}`);
                  }
                }}
              />
            )}

            {loadingLogs && <ActivityIndicator />}
            {logError && <Text style={{ color: 'red' }}>{logError}</Text>}

            {!loadingLogs && !logError && (
              <>
                {/* Totals */}
                <View style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 12 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Totals</Text>
                  <Text>
                    {Math.round(entries.reduce((s, e) => s + e.kcal, 0))} kcal
                    {' | '}P {Math.round(entries.reduce((s, e) => s + e.protein_g, 0) * 10) / 10}g
                    {' | '}C {Math.round(entries.reduce((s, e) => s + e.carbs_g, 0) * 10) / 10}g
                    {' | '}F {Math.round(entries.reduce((s, e) => s + e.fat_g, 0) * 10) / 10}g
                  </Text>
                </View>

                {/* Entry list */}
                {entries.length === 0 ? (
                  <Text style={{ color: '#888' }}>Nothing logged for this day.</Text>
                ) : (
                  entries.map((e) => (
                    <TouchableOpacity key={e.id} onPress={() => router.push(`/log/${e.id}`)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
                      <Text style={{ fontWeight: 'bold' }}>
                        {e.food_name} — {e.grams}g
                        <Text style={{ fontWeight: 'normal', color: '#888' }}>
                          {' '}{new Date(e.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                      </Text>
                      <Text style={{ color: '#555', fontSize: 12 }}>
                        {Math.round(e.kcal)} kcal
                        {' | '}P {Math.round(e.protein_g * 10) / 10}g
                        {' | '}C {Math.round(e.carbs_g * 10) / 10}g
                        {' | '}F {Math.round(e.fat_g * 10) / 10}g
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
