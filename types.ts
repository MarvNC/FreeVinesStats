
export interface HistoryItem {
  t: number;          // Timestamp (ms)
  ai?: number;        // "AI" Items (new field name)
  encore?: number;    // Legacy "AI" Items
  last_chance: number;// "AFA" Items
  zero_etv?: number;  // Zero-ETV Items
}

export interface StatsMeta {
  totalItems: number;
  updatedAt: string;
}

export interface StatsData {
  meta: StatsMeta;
  history: HistoryItem[];
}

export interface DashboardStats {
  lastHour: number;
  today: number;
  todayGrowth: number; // Percentage
  todayMedian: number;
  thisWeek: number;
  weekGrowth: number; // Percentage
  weekMedian: number;
  updatedAt: Date | null;
}

export type Timeframe = '1d' | '7d' | '1m' | '3m' | '1y';
export type Granularity = '5m' | '1h' | '1d';
export type DataFilter = 'all' | 'zeroEtv' | 'afa';

export interface ChartDataPoint {
  date: number;
  ai: number;
  lastChance: number;
  zeroEtv: number;
  total: number;
  label: string; // Formatted date for axis
  fullDate: string; // YYYY-MM-DD for tooltip
}

export interface HeatMapData {
  weekly: Record<string, number>; // YYYY-MM-DD -> count
  hourlyMedian: number[][]; // 7 days x 24 hours
  hourlyMean: number[][];   // 7 days x 24 hours
  maxDaily: number;
  maxHourlyMedian: number;
  maxHourlyMean: number;
}
