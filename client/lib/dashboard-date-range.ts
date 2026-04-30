export type Preset = '7d' | '30d' | '90d' | '365d';

export type DateRange = {
  start: Date;
  end: Date;
  preset: Preset | 'custom';
};

export function presetToRange(preset: Preset, now = new Date()): DateRange {
  const daysBack: Record<Preset, number> = {
    '7d': 6,
    '30d': 29,
    '90d': 89,
    '365d': 364,
  };

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack[preset]);

  return { start, end, preset };
}
