import { describe, it, expect } from 'bun:test';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import _ from 'lodash';
import { performance } from 'node:perf_hooks';

import { processStats } from '../utils/analytics';
import type { HistoryItem, DashboardStats } from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TIMEZONE = 'America/Los_Angeles';
const INTERVAL_MS = 15 * 60 * 1000;
const YEAR_INTERVALS = 365 * 24 * 4; // 15-minute buckets

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const getAiCount = (item: HistoryItem): number => item.ai ?? item.encore ?? 0;

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const generateMockData = (): HistoryItem[] => {
  const now = Date.now();
  const end = Math.floor(now / INTERVAL_MS) * INTERVAL_MS;
  const start = end - YEAR_INTERVALS * INTERVAL_MS;
  const data: HistoryItem[] = new Array(YEAR_INTERVALS);

  for (let i = 0; i < YEAR_INTERVALS; i++) {
    const t = start + i * INTERVAL_MS;
    const useEncore = Math.random() < 0.2;
    const aiValue = randomInt(0, 5);

    data[i] = {
      t,
      ...(useEncore ? { encore: aiValue } : { ai: aiValue }),
      last_chance: randomInt(0, 3),
      zero_etv: randomInt(0, 2)
    };
  }

  return data;
};

const processStatsLegacy = (history: HistoryItem[], updatedAtStr: string): DashboardStats => {
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
    h => getAiCount(h) + h.last_chance
  );

  // 2. Today (PST)
  const todayStart = nowPst.startOf('day');
  const todayTotal = _.sumBy(
    history.filter(h => h.t >= todayStart.valueOf()),
    h => getAiCount(h) + h.last_chance
  );

  // Median Daily
  const dailyGroups = _.groupBy(
    history.filter(h => h.t < todayStart.valueOf()),
    h => dayjs(h.t).tz(TIMEZONE).format('YYYY-MM-DD')
  );

  const dailyTotals = Object.values(dailyGroups).map(items =>
    _.sumBy(items, i => getAiCount(i) + i.last_chance)
  );

  const dailyMedian = Math.round(calculateMedian(dailyTotals));
  const todayGrowth = dailyMedian === 0 ? 100 : Math.round(((todayTotal - dailyMedian) / dailyMedian) * 100);

  // 3. This Week (PST, Monday Start)
  const weekStart = nowPst.startOf('isoWeek');
  const thisWeekTotal = _.sumBy(
    history.filter(h => h.t >= weekStart.valueOf()),
    h => getAiCount(h) + h.last_chance
  );

  // Median Weekly
  const weeklyGroups = _.groupBy(
    history.filter(h => h.t < weekStart.valueOf()),
    h => dayjs(h.t).tz(TIMEZONE).startOf('isoWeek').format('YYYY-MM-DD')
  );

  const weeklyTotals = Object.values(weeklyGroups).map(items =>
    _.sumBy(items, i => getAiCount(i) + i.last_chance)
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

const processStatsOptimized = (history: HistoryItem[], updatedAtStr: string): DashboardStats => {
  return processStats(history, updatedAtStr);
};

type BenchmarkResult = {
  expectedResult: DashboardStats;
  actualResult: DashboardStats;
  baselineTimeMs: number;
  optimizedTimeMs: number;
  speedup: number;
  matches: boolean;
};

const runBenchmark = (): BenchmarkResult => {
  const mockData = generateMockData();
  const updatedAtStr = new Date().toISOString();

  const baselineStart = performance.now();
  const expectedResult = processStatsLegacy(mockData, updatedAtStr);
  const baselineEnd = performance.now();
  const baselineTime = baselineEnd - baselineStart;

  console.log(`[Baseline] Time: ${baselineTime.toFixed(2)} ms`);

  const optimizedStart = performance.now();
  const actualResult = processStatsOptimized(mockData, updatedAtStr);
  const optimizedEnd = performance.now();
  const optimizedTime = optimizedEnd - optimizedStart;

  console.log(`[Optimized] Time: ${optimizedTime.toFixed(2)} ms`);

  const matches = _.isEqual(expectedResult, actualResult);
  if (matches) {
    console.log('✅ SUCCESS: Results match');
  } else {
    console.log('❌ FAILURE: Results differ');
  }

  const safeOptimizedTime = Math.max(optimizedTime, 0.0001);
  const speedup = baselineTime / safeOptimizedTime;
  console.log(`Speedup: ${speedup.toFixed(2)}x`);

  return {
    expectedResult,
    actualResult,
    baselineTimeMs: baselineTime,
    optimizedTimeMs: optimizedTime,
    speedup,
    matches
  };
};

describe('processStats benchmark', () => {
  it(
    'matches baseline output',
    () => {
      const result = runBenchmark();
      expect(result.matches).toBe(true);
    },
    60000
  );
});
