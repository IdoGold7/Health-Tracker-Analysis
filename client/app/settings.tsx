import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { parsePositive } from '../lib/body-metrics-helpers';
import { calcMacroTargets } from '../lib/macro-target-helpers';

type ProfileRow = {
  height_m: number | null;
  target_kcal: number | null;
  target_weight_kg: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};

/** Parse for live recompute: null for empty or invalid (helper tolerates null). */
function parseForCompute(value: string): number | null {
  const t = value.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function Settings() {
  const [heightM, setHeightM] = useState('');
  const [targetKcal, setTargetKcal] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [latestBodyWeight, setLatestBodyWeight] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadError('Not signed in.');
          setLoading(false);
          return;
        }

        const [profileRes, weightRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('height_m, target_kcal, target_weight_kg, target_protein_g, target_carbs_g, target_fat_g')
            .eq('id', user.id)
            .single(),
          supabase
            .from('body_metrics')
            .select('weight_kg')
            .not('weight_kg', 'is', null)
            .order('logged_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (weightRes.error) throw weightRes.error;

        const p = profileRes.data as ProfileRow;
        setHeightM(p.height_m != null ? String(Number(p.height_m)) : '');
        setTargetKcal(p.target_kcal != null ? String(p.target_kcal) : '');
        setTargetWeightKg(p.target_weight_kg != null ? String(Number(p.target_weight_kg)) : '');
        setLatestBodyWeight(
          weightRes.data?.weight_kg != null ? Number(weightRes.data.weight_kg) : null
        );
      } catch (err: any) {
        setLoadError(err.message ?? 'Failed to load settings.');
      }
      setLoading(false);
    })();
  }, []);

  // --- Live compute ---
  const liveKcal = parseForCompute(targetKcal);
  const liveTargetWeight = parseForCompute(targetWeightKg);
  const effectiveWeight = liveTargetWeight ?? latestBodyWeight;
  const effectiveWeightSource: 'target' | 'latest' | 'none' =
    liveTargetWeight != null ? 'target' : latestBodyWeight != null ? 'latest' : 'none';
  const liveMacros = calcMacroTargets(liveKcal, effectiveWeight);

  // --- Save ---
  function validate(): { height: number | null; kcal: number | null; weight: number | null; error: string | null } {
    const h = parsePositive(heightM);
    const k = parsePositive(targetKcal);
    const w = parsePositive(targetWeightKg);

    if (typeof h === 'number' && isNaN(h)) return { height: null, kcal: null, weight: null, error: 'Height must be a number > 0' };
    if (typeof k === 'number' && isNaN(k)) return { height: null, kcal: null, weight: null, error: 'Daily calories must be a number > 0' };
    if (typeof w === 'number' && isNaN(w)) return { height: null, kcal: null, weight: null, error: 'Target weight must be a number > 0' };

    // Apply DB precision on save
    const heightRounded = h != null ? Math.round(h * 100) / 100 : null;
    const kcalRounded = k != null ? Math.round(k) : null;
    const weightRounded = w != null ? Math.round(w * 100) / 100 : null;

    return { height: heightRounded, kcal: kcalRounded, weight: weightRounded, error: null };
  }

  async function handleSave() {
    setSubmitError(null);
    setSubmitSuccess(null);

    const { height, kcal, weight, error } = validate();
    if (error) {
      setSubmitError(error);
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError('Not signed in.');
      setSubmitting(false);
      return;
    }

    const effWeight = weight ?? latestBodyWeight;
    const macros = calcMacroTargets(kcal, effWeight);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        height_m: height,
        target_kcal: kcal,
        target_weight_kg: weight,
        target_protein_g: macros?.protein_g ?? null,
        target_carbs_g: macros?.carbs_g ?? null,
        target_fat_g: macros?.fat_g ?? null,
      })
      .eq('id', user.id);

    if (updateError) {
      setSubmitError(updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitSuccess('Saved!');
    setSubmitting(false);
    setTimeout(() => setSubmitSuccess(null), 3000);
  }

  if (loading) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: 'red' }}>{loadError}</Text>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={{ color: '#2196F3' }}>← Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const weightSourceLine =
    effectiveWeightSource === 'target'
      ? `Using target weight: ${effectiveWeight} kg`
      : effectiveWeightSource === 'latest'
      ? `Using latest weigh-in: ${latestBodyWeight} kg`
      : 'No weight available — set target weight to compute macro targets';

  return (
    <ScrollView>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Settings</Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Profile</Text>

          <TextInput
            placeholder="Height (m), e.g. 1.75"
            value={heightM}
            onChangeText={setHeightM}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Daily calories (kcal)"
            value={targetKcal}
            onChangeText={setTargetKcal}
            keyboardType="number-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
          <TextInput
            placeholder="Target weight (kg)"
            value={targetWeightKg}
            onChangeText={setTargetWeightKg}
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, padding: 8, borderRadius: 4 }}
          />
        </View>

        <View style={{ gap: 4, marginTop: 8, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          <Text style={{ fontWeight: 'bold' }}>Macro Targets</Text>
          <Text style={{ color: '#555', fontSize: 12 }}>{weightSourceLine}</Text>
          <Text>
            Protein: {liveMacros ? `${liveMacros.protein_g} g` : '-'}
            {'  |  '}Carbs: {liveMacros ? `${liveMacros.carbs_g} g` : '-'}
            {'  |  '}Fat: {liveMacros ? `${liveMacros.fat_g} g` : '-'}
          </Text>
        </View>

        <TouchableOpacity
          style={{
            marginTop: 12,
            backgroundColor: submitting ? '#999' : '#2196F3',
            padding: 12,
            borderRadius: 4,
            alignItems: 'center',
          }}
          onPress={handleSave}
          activeOpacity={submitting ? 1 : 0.7}
          disabled={submitting}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            {submitting ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>

        {submitError && <Text style={{ color: 'red' }}>{submitError}</Text>}
        {submitSuccess && <Text style={{ color: 'green' }}>{submitSuccess}</Text>}

        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 8 }}>
          <Text style={{ color: '#2196F3' }}>← Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
