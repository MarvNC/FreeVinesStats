import { HistoryItem, DashboardStats, ChartDataPoint, HeatMapData, Granularity } from '../types';
import _ from 'lodash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TIMEZONE = 'America/Los_Angeles';

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const processStats = (history: HistoryItem[], updatedAtStr: string): DashboardStats => {
  if (!history.length) {
    return {
      lastHour: 0,
      today: 0,
      todayGrowth: 0,
      todayMedian: 0,
      thisWeek: 0,
      weekGrowth: 0,
      weekMedian: 0,
      updatedAt: null
    };
  }

  const updatedAt = dayjs(updatedAtStr);
  const now = dayjs();
  const nowPst = now.tz(TIMEZONE);

  // 1. Last Hour
  const oneHourAgo = now.subtract(1, 'hour');
  const lastHourTotal = _.sumBy(
    history.filter(h => h.t > oneHourAgo.valueOf()),
    h => h.encore + h.last_chance
  );

  // 2. Today (PST)
  const todayStart = nowPst.startOf('day');
  const todayTotal = _.sumBy(
    history.filter(h => h.t >= todayStart.valueOf()),
    h => h.encore + h.last_chance
  );

  // Median Daily
  const dailyGroups = _.groupBy(
    history.filter(h => h.t < todayStart.valueOf()),
    h => dayjs(h.t).tz(TIMEZONE).format('YYYY-MM-DD')
  );
  
  const dailyTotals = Object.values(dailyGroups).map(items => 
    _.sumBy(items, i => i.encore + i.last_chance)
  );
  
  const dailyMedian = Math.round(calculateMedian(dailyTotals));
  const todayGrowth = dailyMedian === 0 ? 100 : Math.round(((todayTotal - dailyMedian) / dailyMedian) * 100);

  // 3. This Week (PST, Monday Start)
  const weekStart = nowPst.startOf('isoWeek');
  const thisWeekTotal = _.sumBy(
    history.filter(h => h.t >= weekStart.valueOf()),
    h => h.encore + h.last_chance
  );

  // Median Weekly
  const weeklyGroups = _.groupBy(
    history.filter(h => h.t < weekStart.valueOf()),
    h => dayjs(h.t).tz(TIMEZONE).startOf('isoWeek').format('YYYY-MM-DD')
  );

  const weeklyTotals = Object.values(weeklyGroups).map(items => 
    _.sumBy(items, i => i.encore + i.last_chance)
  );

  const weeklyMedian = Math.round(calculateMedian(weeklyTotals));
  const weekGrowth = weeklyMedian === 0 ? 100 : Math.round(((thisWeekTotal - weeklyMedian) / weeklyMedian) * 100);

  return {
    lastHour: lastHourTotal,
    today: todayTotal,
    todayGrowth,
    todayMedian: dailyMedian,
    thisWeek: thisWeekTotal,
    weekGrowth,
    weekMedian: weeklyMedian,
    updatedAt: updatedAt.toDate()
  };
};

export const processChartData = (history: HistoryItem[], granularity: Granularity): ChartDataPoint[] => {
  if (!history.length) return [];

  const sortedHistory = [...history].sort((a, b) => a.t - b.t);
  const minTime = sortedHistory[0].t;
  const maxTime = Math.max(dayjs().valueOf(), sortedHistory[sortedHistory.length - 1].t);
  
  const dataMap: Record<string, { encore: number; lastChance: number }> = {};
  
  // Helper to generate key based on granularity in PST
  const getKey = (ts: number): string => {
    const d = dayjs(ts).tz(TIMEZONE);
    if (granularity === '1d') return d.format('YYYY-MM-DD');
    if (granularity === '1h') return d.format('YYYY-MM-DD HH:00');
    if (granularity === '5m') {
      const minute = d.minute();
      const roundedMinute = Math.floor(minute / 5) * 5;
      return d.format(`YYYY-MM-DD HH:${String(roundedMinute).padStart(2, '0')}`);
    }
    return '';
  };

  sortedHistory.forEach(h => {
    const key = getKey(h.t);
    const existing = dataMap[key] || { encore: 0, lastChance: 0 };
    dataMap[key] = {
      encore: existing.encore + h.encore,
      lastChance: existing.lastChance + h.last_chance
    };
  });

  const results: ChartDataPoint[] = [];
  
  // Iterate from start to end to fill gaps
  let cursor = dayjs(minTime).tz(TIMEZONE);
  
  // Align cursor start based on granularity
  if (granularity === '1d') cursor = cursor.startOf('day');
  if (granularity === '1h') cursor = cursor.startOf('hour');
  if (granularity === '5m') {
    const m = cursor.minute();
    cursor = cursor.minute(Math.floor(m / 5) * 5).startOf('minute');
  }

  const end = dayjs(maxTime).tz(TIMEZONE);

  while (cursor.isBefore(end) || cursor.isSame(end)) {
    let key = '';
    let label = '';
    let fullDate = '';

    if (granularity === '1d') {
      key = cursor.format('YYYY-MM-DD');
      label = cursor.format('MMM DD');
      fullDate = key;
    } else if (granularity === '1h') {
      key = cursor.format('YYYY-MM-DD HH:00');
      label = cursor.format('MMM DD HH:mm');
      fullDate = key;
    } else {
      key = cursor.format('YYYY-MM-DD HH:mm');
      label = cursor.format('HH:mm');
      fullDate = key;
    }

    const encore = dataMap[key]?.encore || 0;
    const lastChance = dataMap[key]?.lastChance || 0;
    results.push({
      date: cursor.valueOf(),
      encore,
      lastChance,
      total: encore + lastChance,
      label,
      fullDate
    });

    if (granularity === '1d') cursor = cursor.add(1, 'day');
    else if (granularity === '1h') cursor = cursor.add(1, 'hour');
    else cursor = cursor.add(5, 'minute');
  }

  return results;
};

export const processHeatMaps = (history: HistoryItem[]): HeatMapData => {
  const cutoff = dayjs().subtract(1, 'year').valueOf();
  const recentHistory = history.filter(h => h.t > cutoff);

  const weeklyMap: Record<string, number> = {};
  
  // Intermediate aggregation: Key "YYYY-MM-DD HH" -> Total Drops
  const hourlyTotalsMap: Map<string, number> = new Map();
  
  // Track earliest timestamp in this set to properly calculate the time window
  let minTs = Number.MAX_SAFE_INTEGER;

  recentHistory.forEach(h => {
    if (h.t < minTs) minTs = h.t;
    
    const d = dayjs(h.t).tz(TIMEZONE);
    const total = h.encore + h.last_chance;
    
    // Weekly Map (Total sum for daily view)
    const dayKey = d.format('YYYY-MM-DD');
    weeklyMap[dayKey] = (weeklyMap[dayKey] || 0) + total;

    // Hourly Map Prep (Sum for specific date-hour)
    const hourKey = d.format('YYYY-MM-DD HH');
    hourlyTotalsMap.set(hourKey, (hourlyTotalsMap.get(hourKey) || 0) + total);
  });

  // Prepare samples for median/mean calculation: DayIndex -> HourIndex -> Array of Totals
  const hourlySamples: number[][][] = Array(7).fill(0).map(() => Array(24).fill(0).map(() => []));
  
  for (const [key, total] of hourlyTotalsMap.entries()) {
    // Key format: "YYYY-MM-DD HH"
    const dateStr = key.substring(0, 10);
    const hourStr = key.substring(11, 13);
    const hourIndex = parseInt(hourStr, 10);
    
    const d = dayjs.tz(dateStr, TIMEZONE);
    // day() returns 0 (Sun) - 6 (Sat). Convert to 0 (Mon) - 6 (Sun)
    const dayOfWeek = d.day(); 
    const dayIndex = (dayOfWeek + 6) % 7; 
    
    if (dayIndex >= 0 && dayIndex < 7 && hourIndex >= 0 && hourIndex < 24) {
        hourlySamples[dayIndex][hourIndex].push(total);
    }
  }

  // Calculate Median & Mean Matrices
  const hourlyMedianMatrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  const hourlyMeanMatrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  
  // Determine how many times each weekday occurred since the oldest data point (or cutoff)
  const now = dayjs().tz(TIMEZONE);
  const startTs = (recentHistory.length > 0 && minTs !== Number.MAX_SAFE_INTEGER) ? minTs : cutoff;
  
  const start = dayjs(startTs).tz(TIMEZONE);
  const weekdayOccurrences = Array(7).fill(0);
  
  let cursor = start.startOf('day');
  const end = now.endOf('day');
  
  let safety = 0;
  while(cursor.isBefore(end) && safety < 400) {
      const dayOfWeek = cursor.day();
      const dayIndex = (dayOfWeek + 6) % 7;
      weekdayOccurrences[dayIndex]++;
      cursor = cursor.add(1, 'day');
      safety++;
  }

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
       const samples = hourlySamples[d][h];
       const totalSlots = Math.max(weekdayOccurrences[d], 1); // Avoid div by zero
       
       // --- Median Calculation ---
       // Ensure we account for days with zero drops
       const count = Math.max(totalSlots, samples.length);
       const zeroCount = Math.max(0, count - samples.length);
       
       const sortedSamples = [...samples].sort((a, b) => a - b);
       
       const getVal = (idx: number) => {
         if (idx < zeroCount) return 0;
         return sortedSamples[idx - zeroCount];
       };
       
       const mid = Math.floor(count / 2);
       let median = 0;
       
       if (count > 0) {
          if (count % 2 !== 0) {
             median = getVal(mid);
          } else {
             median = (getVal(mid - 1) + getVal(mid)) / 2;
          }
       }
       hourlyMedianMatrix[d][h] = Math.round(median * 10) / 10;

       // --- Mean Calculation ---
       const sum = samples.reduce((acc, val) => acc + val, 0);
       const mean = sum / totalSlots;
       hourlyMeanMatrix[d][h] = Math.round(mean * 10) / 10;
    }
  }

  return {
    weekly: weeklyMap,
    hourlyMedian: hourlyMedianMatrix,
    hourlyMean: hourlyMeanMatrix,
    maxDaily: Math.max(...Object.values(weeklyMap), 1),
    maxHourlyMedian: Math.max(...hourlyMedianMatrix.flat(), 1),
    maxHourlyMean: Math.max(...hourlyMeanMatrix.flat(), 1)
  };
};

export const getHeatColor = (value: number, max: number): string => {
  if (value === 0) return 'bg-slate-100 dark:bg-slate-700';
  const ratio = value / max;
  if (ratio < 0.2) return 'bg-heat-1';
  if (ratio < 0.4) return 'bg-heat-2';
  if (ratio < 0.6) return 'bg-heat-3';
  if (ratio < 0.8) return 'bg-heat-4';
  return 'bg-heat-5';
};
