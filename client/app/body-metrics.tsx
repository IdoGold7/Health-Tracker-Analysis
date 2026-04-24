import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { todayStr, parsePositive, parseBodyFat, buildLoggedAt, fetchLatestBodyMetricsAsOf } from '../lib/body-metrics-helpers';

// --- Component ---

export default function BodyMetrics() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = params.date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(`${d}T12:00:00`).getTime())) {
      return d;
    }
    return todayStr();
  });
  const [showPicker, setShowPicker] = useState(false);

  // Body metric fields (string inputs)
  const [weightKg, setWeightKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [forearmCm, setForearmCm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Pre-fill inputs with the latest prior entry on or before the selected date
  useEffect(() => {
    (async () => {
      try {
        const latest = await fetchLatestBodyMetricsAsOf(selectedDate);
        if (!latest) return;
        if (latest.weight_kg != null) setWeightKg(String(latest.weight_kg));
        if (latest.body_fat_pct != null) setBodyFatPct(String(latest.body_fat_pct));
        if (latest.neck_cm != null) setNeckCm(String(latest.neck_cm));
        if (latest.waist_cm != null) setWaistCm(String(latest.waist_cm));
        if (latest.forearm_cm != null) setForearmCm(String(latest.forearm_cm));
      } catch (err) {
        console.error('Failed to pre-fill body metrics:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Validation ---

  function validate(): { bodyMetrics: Record<string, number | null> | null; error: string | null } {
    const w = parsePositive(weightKg);
    const bf = parseBodyFat(bodyFatPct);
    const n = parsePositive(neckCm);
    const wa = parsePositive(waistCm);
    const f = parsePositive(forearmCm);

    if (typeof w === 'number' && isNaN(w)) return { bodyMetrics: null, error: 'Weight must be a number > 0' };
    if (typeof bf === 'number' && isNaN(bf)) return { bodyMetrics: null, error: 'Body fat % must be a number between 0 and 100' };
    if (typeof n === 'number' && isNaN(n)) return { bodyMetrics: null, error: 'Neck must be a number > 0' };
    if (typeof wa === 'number' && isNaN(wa)) return { bodyMetrics: null, error: 'Waist must be a number > 0' };
    if (typeof f === 'number' && isNaN(f)) return { bodyMetrics: null, error: 'Forearm must be a number > 0' };

    const hasBodyMetrics = w != null || bf != null || n != null || wa != null || f != null;

    if (!hasBodyMetrics) {
      return { bodyMetrics: null, error: 'Nothing to submit — enter at least one metric.' };
    }

    return {
      bodyMetrics: { weight_kg: w, body_fat_pct: bf, neck_cm: n, waist_cm: wa, forearm_cm: f },
      error: null,
    };
  }

  // --- Submit ---

  function clearBodyMetricFields() {
    setWeightKg('');
    setBodyFatPct('');
    setNeckCm('');
    setWaistCm('');
    setForearmCm('');
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitSuccess(null);

    const { bodyMetrics, error: validationError } = validate();
    if (validationError || !bodyMetrics) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError('Not signed in.');
      setSubmitting(false);
      return;
    }

    const loggedAt = buildLoggedAt(selectedDate);

    const { error: insertError } = await supabase
      .from('body_metrics')
      .insert({
        user_id: user.id,
        weight_kg: bodyMetrics.weight_kg,
        body_fat_pct: bodyMetrics.body_fat_pct,
        neck_cm: bodyMetrics.neck_cm,
        waist_cm: bodyMetrics.waist_cm,
        forearm_cm: bodyMetrics.forearm_cm,
        logged_at: loggedAt,
      });

    if (insertError) {
      setSubmitError(insertError.message);
      setSubmitting(false);
      return;
    }

    clearBodyMetricFields();
    setSubmitSuccess('Saved!');
    setSubmitting(false);
    setTimeout(() => setSubmitSuccess(null), 3000);
    router.replace(`/?date=${selectedDate}`);
  }

  // --- Compute whether submit is enabled ---
  const { error: prevalidationError } = validate();
  const canSubmit = prevalidationError === null && !submitting;

  return (
    <ScrollView>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Body Metrics</Text>

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
          <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Check-in</Text>

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

        {/* Submit */}
        <TouchableOpacity
          style={{
            marginTop: 12,
            backgroundColor: canSubmit ? '#2196F3' : '#999',
            padding: 12,
            borderRadius: 4,
            alignItems: 'center',
          }}
          onPress={handleSubmit}
          activeOpacity={canSubmit ? 0.7 : 1}
          disabled={!canSubmit}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            {submitting ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>

        {submitError && <Text style={{ color: 'red' }}>{submitError}</Text>}
        {submitSuccess && <Text style={{ color: 'green' }}>{submitSuccess}</Text>}

        {/* Back to Home */}
        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 8 }}>
          <Text style={{ color: '#2196F3' }}>← Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
