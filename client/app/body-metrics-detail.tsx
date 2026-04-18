import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { parsePositive, parseBodyFat, buildLoggedAt } from '../lib/body-metrics-helpers';

// --- Component ---

export default function BodyMetricsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form fields
  const [selectedDate, setSelectedDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [forearmCm, setForearmCm] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Load entry ---

  useEffect(() => {
    async function load() {
      if (!id) {
        setFetchError('No entry ID provided.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('body_metrics')
        .select('id, weight_kg, body_fat_pct, neck_cm, waist_cm, forearm_cm, logged_at')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        setFetchError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setFetchError('Entry not found.');
        setLoading(false);
        return;
      }

      // Populate fields
      setWeightKg(data.weight_kg != null ? String(Number(data.weight_kg)) : '');
      setBodyFatPct(data.body_fat_pct != null ? String(Number(data.body_fat_pct)) : '');
      setNeckCm(data.neck_cm != null ? String(Number(data.neck_cm)) : '');
      setWaistCm(data.waist_cm != null ? String(Number(data.waist_cm)) : '');
      setForearmCm(data.forearm_cm != null ? String(Number(data.forearm_cm)) : '');

      // Extract local date from logged_at
      const d = new Date(data.logged_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${day}`);

      setLoading(false);
    }

    load();
  }, [id]);

  // --- Validation ---

  function validate(): { fields: Record<string, number | null>; error: string | null } {
    const w = parsePositive(weightKg);
    const bf = parseBodyFat(bodyFatPct);
    const n = parsePositive(neckCm);
    const wa = parsePositive(waistCm);
    const f = parsePositive(forearmCm);

    if (typeof w === 'number' && isNaN(w)) return { fields: {}, error: 'Weight must be a number > 0' };
    if (typeof bf === 'number' && isNaN(bf)) return { fields: {}, error: 'Body fat % must be a number between 0 and 100' };
    if (typeof n === 'number' && isNaN(n)) return { fields: {}, error: 'Neck must be a number > 0' };
    if (typeof wa === 'number' && isNaN(wa)) return { fields: {}, error: 'Waist must be a number > 0' };
    if (typeof f === 'number' && isNaN(f)) return { fields: {}, error: 'Forearm must be a number > 0' };

    const hasAny = w != null || bf != null || n != null || wa != null || f != null;
    if (!hasAny) {
      return { fields: {}, error: 'At least one metric field is required.' };
    }

    return {
      fields: { weight_kg: w, body_fat_pct: bf, neck_cm: n, waist_cm: wa, forearm_cm: f },
      error: null,
    };
  }

  // --- Save ---

  async function handleSave() {
    setActionError(null);

    const { fields, error: validationError } = validate();
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setSaving(true);

    const loggedAt = buildLoggedAt(selectedDate);

    const { data, error } = await supabase
      .from('body_metrics')
      .update({
        weight_kg: fields.weight_kg,
        body_fat_pct: fields.body_fat_pct,
        neck_cm: fields.neck_cm,
        waist_cm: fields.waist_cm,
        forearm_cm: fields.forearm_cm,
        logged_at: loggedAt,
      })
      .eq('id', id!)
      .select();

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      setActionError('Entry no longer available — it may have been deleted.');
      setSaving(false);
      return;
    }

    router.replace('/');
  }

  // --- Delete ---

  function handleDelete() {
    Alert.alert('Delete this check-in? This cannot be undone.', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setActionError(null);

          const { data, error } = await supabase
            .from('body_metrics')
            .delete()
            .eq('id', id!)
            .select();

          if (error) {
            setActionError(error.message);
            setDeleting(false);
            return;
          }

          if (!data || data.length === 0) {
            setActionError('Entry no longer available — it may have been deleted.');
            setDeleting(false);
            return;
          }

          router.replace('/');
        },
      },
    ]);
  }

  // --- Render ---

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ color: 'red', fontSize: 16 }}>{fetchError}</Text>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={{ color: '#2196F3' }}>← Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { error: prevalidationError } = validate();
  const canSave = prevalidationError === null && !saving && !deleting;
  const inFlight = saving || deleting;

  return (
    <ScrollView>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Edit Check-in</Text>

        {/* Date picker */}
        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          style={{ backgroundColor: '#f0f0f0', padding: 10, borderRadius: 4 }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{selectedDate}  ▼</Text>
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

        {/* Body metric fields */}
        <View style={{ gap: 8 }}>
          <TextInput
            placeholder="Weight (kg)"
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Body fat (%)"
            value={bodyFatPct}
            onChangeText={setBodyFatPct}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Neck (cm)"
            value={neckCm}
            onChangeText={setNeckCm}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Waist (cm)"
            value={waistCm}
            onChangeText={setWaistCm}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Forearm (cm)"
            value={forearmCm}
            onChangeText={setForearmCm}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
        </View>

        {prevalidationError && (
          <Text style={{ color: 'red' }}>{prevalidationError}</Text>
        )}

        {actionError && <Text style={{ color: 'red' }}>{actionError}</Text>}

        {/* Save */}
        <TouchableOpacity
          style={{
            backgroundColor: canSave ? '#2196F3' : '#999',
            padding: 12,
            borderRadius: 4,
            alignItems: 'center',
          }}
          onPress={handleSave}
          activeOpacity={canSave ? 0.7 : 1}
          disabled={!canSave}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={{
            backgroundColor: inFlight ? '#999' : '#d32f2f',
            padding: 12,
            borderRadius: 4,
            alignItems: 'center',
          }}
          onPress={handleDelete}
          activeOpacity={inFlight ? 1 : 0.7}
          disabled={inFlight}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Text>
        </TouchableOpacity>

        {/* Back to Home */}
        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 8 }}>
          <Text style={{ color: '#2196F3' }}>← Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
