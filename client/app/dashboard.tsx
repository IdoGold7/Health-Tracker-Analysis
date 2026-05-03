import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { presetToRange, Preset, DateRange } from '../lib/dashboard-date-range';
import { supabase } from '../lib/supabase';
import { getDashboardFoodLogs, getDashboardBodyMetrics, getLatestWeight, DailyMacros, BodyMetricsDataPoint } from '../lib/dashboard-queries';
import { computeSummaryStats, computeAdherence, calcTotalDaysInRange } from '../lib/dashboard-stats';

type DashboardProfile = {
  height_m: number | null;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};

const PRESETS: Preset[] = ['7d', '30d', '90d', '365d'];

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dailyMacros, setDailyMacros] = useState<DailyMacros[]>([]);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricsDataPoint[]>([]);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profileResult, weight] = await Promise.all([
        supabase
          .from('profiles')
          .select('height_m, target_kcal, target_protein_g, target_carbs_g, target_fat_g')
          .single(),
        getLatestWeight(supabase),
      ]);
      if (cancelled) return;
      if (profileResult.error) {
        console.error('Failed to fetch profile:', profileResult.error);
      }
      const d = profileResult.data;
      setProfile(d ? {
        height_m: d.height_m != null ? Number(d.height_m) : null,
        target_kcal: d.target_kcal != null ? Number(d.target_kcal) : null,
        target_protein_g: d.target_protein_g != null ? Number(d.target_protein_g) : null,
        target_carbs_g: d.target_carbs_g != null ? Number(d.target_carbs_g) : null,
        target_fat_g: d.target_fat_g != null ? Number(d.target_fat_g) : null,
      } : null);
      setLatestWeightKg(weight);
      setProfileLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [foodLogs, bm] = await Promise.all([
        getDashboardFoodLogs(supabase, dateRange.start, dateRange.end),
        getDashboardBodyMetrics(supabase, dateRange.start, dateRange.end, profile?.height_m ?? null),
      ]);
      if (cancelled) return;
      setDailyMacros(foodLogs);
      setBodyMetrics(bm);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [dateRange, profileLoaded]);

  const totalDays = useMemo(
    () => calcTotalDaysInRange(dateRange.start, dateRange.end),
    [dateRange.start.getTime(), dateRange.end.getTime()]
  );
  const summaryStats = useMemo(
    () => computeSummaryStats(dailyMacros, bodyMetrics, latestWeightKg, profile?.height_m ?? null, totalDays),
    [dailyMacros, bodyMetrics, latestWeightKg, profile?.height_m, totalDays]
  );
  const adherence = useMemo(
    () => computeAdherence(dailyMacros, profile ?? { target_kcal: null, target_protein_g: null, target_carbs_g: null, target_fat_g: null }),
    [dailyMacros, profile?.target_kcal, profile?.target_protein_g, profile?.target_carbs_g, profile?.target_fat_g]
  );

  function handlePreset(preset: Preset) {
    const range = presetToRange(preset);
    setDateRange(range);
  }

  function handleCustomStart(event: DateTimePickerEvent, date?: Date) {
    setShowStartPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (newStart >= dateRange.end) return;
      const range: DateRange = { start: newStart, end: dateRange.end, preset: 'custom' };
      setDateRange(range);
    }
  }

  function handleCustomEnd(event: DateTimePickerEvent, date?: Date) {
    setShowEndPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      const exclusiveEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      if (dateRange.start >= exclusiveEnd) return;
      const range: DateRange = { start: dateRange.start, end: exclusiveEnd, preset: 'custom' };
      setDateRange(range);
    }
  }

  function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const displayEnd = new Date(dateRange.end.getTime() - 86400000);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Dashboard</Text>

        {/* Preset buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => handlePreset(p)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 4,
                alignItems: 'center',
                backgroundColor: dateRange.preset === p ? '#2196F3' : '#f0f0f0',
              }}
            >
              <Text
                style={{
                  fontWeight: 'bold',
                  color: dateRange.preset === p ? '#fff' : '#333',
                }}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom date pickers */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setShowStartPicker(true)}
            style={{ flex: 1, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 4 }}
          >
            <Text style={{ fontSize: 12, color: '#888' }}>Start</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{formatDate(dateRange.start)}  ▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowEndPicker(true)}
            style={{ flex: 1, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 4 }}
          >
            <Text style={{ fontSize: 12, color: '#888' }}>End</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{formatDate(displayEnd)}  ▼</Text>
          </TouchableOpacity>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={dateRange.start}
            mode="date"
            onChange={handleCustomStart}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={displayEnd}
            mode="date"
            onChange={handleCustomEnd}
          />
        )}

        {loading && (
          <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 20 }} />
        )}

        {!loading && (
          <View style={{ marginTop: 16, gap: 12 }}>
            {summaryStats.avg_kcal != null ? (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 16 }}>Avg Kcal: {summaryStats.avg_kcal}</Text>
                <Text style={{ fontSize: 16 }}>Avg Protein: {summaryStats.avg_protein_g}g</Text>
                <Text style={{ fontSize: 16 }}>Avg Carbs: {summaryStats.avg_carbs_g}g</Text>
                <Text style={{ fontSize: 16 }}>Avg Fat: {summaryStats.avg_fat_g}g</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 16, color: '#888' }}>No food logs in this range</Text>
            )}

            <Text style={{ fontSize: 16 }}>
              {summaryStats.weight_delta_kg != null
                ? `${summaryStats.weight_delta_kg > 0 ? '+' : ''}${summaryStats.weight_delta_kg} kg`
                : 'Not enough weigh-ins in range'}
            </Text>

            <Text style={{ fontSize: 16 }}>
              BMI: {summaryStats.current_bmi != null ? summaryStats.current_bmi : '—'}
            </Text>

            <Text style={{ fontSize: 16 }}>
              Logged {summaryStats.days_logged} / {summaryStats.total_days_in_range} days
            </Text>

            {summaryStats.days_logged > 0 &&
              (adherence.kcal != null || adherence.protein != null || adherence.carbs != null || adherence.fat != null) && (
              <View style={{ marginTop: 8, gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Target Adherence</Text>
                {adherence.kcal != null && (
                  <Text style={{ fontSize: 16 }}>Kcal: {adherence.kcal} / {summaryStats.days_logged} days</Text>
                )}
                {adherence.protein != null && (
                  <Text style={{ fontSize: 16 }}>Protein: {adherence.protein} / {summaryStats.days_logged} days</Text>
                )}
                {adherence.carbs != null && (
                  <Text style={{ fontSize: 16 }}>Carbs: {adherence.carbs} / {summaryStats.days_logged} days</Text>
                )}
                {adherence.fat != null && (
                  <Text style={{ fontSize: 16 }}>Fat: {adherence.fat} / {summaryStats.days_logged} days</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
