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

const INTERVAL_MS = 15 * 60 * 1000;
const YEAR_INTERVALS = 365 * 24 * 4; // 15-minute buckets

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
  const expectedResult = processStats(mockData, updatedAtStr);
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
