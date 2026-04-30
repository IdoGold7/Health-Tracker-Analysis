import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { presetToRange, Preset, DateRange } from '../lib/dashboard-date-range';
import { supabase } from '../lib/supabase';
import { getDashboardFoodLogs, getDashboardBodyMetrics, DailyMacros, BodyMetricsDataPoint } from '../lib/dashboard-queries';

const PRESETS: Preset[] = ['7d', '30d', '90d', '365d'];

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));
  const [heightM, setHeightM] = useState<number | null>(null);
  const [heightLoaded, setHeightLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('height_m')
        .single();
      if (cancelled) return;
      if (error) {
        console.error('Failed to fetch profile height_m:', error);
      }
      setHeightM(data?.height_m != null ? Number(data.height_m) : null);
      setHeightLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!heightLoaded) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [foodLogs, bodyMetrics] = await Promise.all([
        getDashboardFoodLogs(supabase, dateRange.start, dateRange.end),
        getDashboardBodyMetrics(supabase, dateRange.start, dateRange.end, heightM),
      ]);
      if (cancelled) return;
      setLoading(false);
      console.log('Dashboard food logs:', foodLogs);
      console.log('Dashboard body metrics:', bodyMetrics);
    })();

    return () => { cancelled = true; };
  }, [dateRange, heightLoaded]);

  function handlePreset(preset: Preset) {
    const range = presetToRange(preset);
    setDateRange(range);
    console.log('dateRange changed:', {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      preset: range.preset,
    });
  }

  function handleCustomStart(event: DateTimePickerEvent, date?: Date) {
    setShowStartPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (newStart >= dateRange.end) return;
      const range: DateRange = { start: newStart, end: dateRange.end, preset: 'custom' };
      setDateRange(range);
      console.log('dateRange changed:', {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
      });
    }
  }

  function handleCustomEnd(event: DateTimePickerEvent, date?: Date) {
    setShowEndPicker(Platform.OS === 'ios');
    if (event.type === 'set' && date) {
      const exclusiveEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      if (dateRange.start >= exclusiveEnd) return;
      const range: DateRange = { start: dateRange.start, end: exclusiveEnd, preset: 'custom' };
      setDateRange(range);
      console.log('dateRange changed:', {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
      });
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
      </View>
    </ScrollView>
  );
}
