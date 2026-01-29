import { HistoryItem, DashboardStats, ChartDataPoint, HeatMapData, Granularity, DataFilter } from '../types';
import _ from 'lodash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TIMEZONE = 'America/Los_Angeles';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type OffsetSegment = { start: number; end: number; offset: number };
type ChartDataPointRaw = Omit<ChartDataPoint, 'label' | 'fullDate'>;

const TZ_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const getTimeZoneOffsetMs = (ts: number): number => {
  const parts = TZ_PARTS_FORMATTER.formatToParts(new Date(ts));
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value);
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }

  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUTC - ts;
};

const findOffsetTransition = (start: number, end: number, offset: number): number => {
  let lo = start;
  let hi = end;

  while (hi - lo > MINUTE_MS) {
    const mid = Math.floor((lo + hi) / 2);
    const midOffset = getTimeZoneOffsetMs(mid);
    if (midOffset === offset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return hi;
};

const buildOffsetSegments = (startTs: number, endTs: number): OffsetSegment[] => {
  const start = Math.min(startTs, endTs);
  const end = Math.max(startTs, endTs);
  const segments: OffsetSegment[] = [];
  let cursor = start;
  let currentOffset = getTimeZoneOffsetMs(cursor);
  let segmentStart = start;

  while (cursor + DAY_MS <= end) {
    const next = cursor + DAY_MS;
    const nextOffset = getTimeZoneOffsetMs(next);

    if (nextOffset !== currentOffset) {
      const transition = findOffsetTransition(cursor, next, currentOffset);
      segments.push({ start: segmentStart, end: transition, offset: currentOffset });
      segmentStart = transition;
      currentOffset = nextOffset;
    }

    cursor = next;
  }

  segments.push({ start: segmentStart, end: end + 1, offset: currentOffset });
  return segments;
};

const getOffsetAt = (ts: number, segments: OffsetSegment[]): number => {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (ts >= segments[i].start) {
      return segments[i].offset;
    }
  }
  return segments[0]?.offset ?? 0;
};

const getOffsetForTs = (ts: number, segments: OffsetSegment[], indexRef: { i: number }): number => {
  while (indexRef.i < segments.length - 1 && ts >= segments[indexRef.i].end) {
    indexRef.i += 1;
  }
  return segments[indexRef.i].offset;
};

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatChartPoints = (raw: ChartDataPointRaw[], granularity: Granularity): ChartDataPoint[] => {
  if (raw.length === 0) return [];

  return raw.map(point => {
    const parts = TZ_PARTS_FORMATTER.formatToParts(new Date(point.date));
    const partMap: Record<string, string> = {};

    for (const part of parts) {
      if (part.type !== 'literal') {
        partMap[part.type] = part.value;
      }
    }

    const year = partMap.year;
    const month = partMap.month;
    const day = partMap.day;
    const hour = partMap.hour ?? '00';
    const minute = partMap.minute ?? '00';
    const monthLabel = MONTH_SHORT[Number(month) - 1] ?? month;

    const fullDate = granularity === '1d'
      ? `${year}-${month}-${day}`
      : `${year}-${month}-${day} ${hour}:${minute}`;

    let label = '';
    if (granularity === '1d') {
      label = `${monthLabel} ${day}`;
    } else if (granularity === '1h') {
      label = `${monthLabel} ${day} ${hour}:${minute}`;
    } else {
      label = `${hour}:${minute}`;
    }

    return {
      ...point,
      label,
      fullDate
    };
  });
};

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const getAiCount = (item: HistoryItem): number => item.ai ?? item.encore ?? 0;
const getZeroEtvCount = (item: HistoryItem): number => item.zero_etv ?? 0;

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

export const processChartData = (history: HistoryItem[], granularity: Granularity, filter: DataFilter = 'all'): ChartDataPoint[] => {
  if (!history.length) return [];

  const endTime = Math.max(Date.now(), history[history.length - 1].t);
  const intervalMs = granularity === '15m' ? 15 * MINUTE_MS : granularity === '1h' ? HOUR_MS : DAY_MS;
  const results: ChartDataPointRaw[] = [];

  if (granularity === '1d') {
    const segments = buildOffsetSegments(history[0].t - DAY_MS, endTime + DAY_MS);
    const startOffset = getOffsetAt(history[0].t, segments);
    const endOffset = getOffsetAt(endTime, segments);
    const startKey = Math.floor((history[0].t + startOffset) / DAY_MS);
    const endKey = Math.floor((endTime + endOffset) / DAY_MS);
    const dayKeyToStart: number[] = new Array(endKey - startKey + 1);

    for (let key = startKey; key <= endKey; key++) {
      const localMidnight = key * DAY_MS;
      let bucketStart = localMidnight - segments[0].offset;

      for (const segment of segments) {
        const candidate = localMidnight - segment.offset;
        if (candidate >= segment.start && candidate < segment.end) {
          bucketStart = candidate;
          break;
        }
      }

      dayKeyToStart[key - startKey] = bucketStart;
    }

    let cursorKey = startKey;
    let historyIndex = 0;
    const offsetIndex = { i: 0 };

    while (cursorKey <= endKey) {
      let ai = 0;
      let lastChance = 0;
      let zeroEtv = 0;

      while (historyIndex < history.length) {
        const item = history[historyIndex];
        const offset = getOffsetForTs(item.t, segments, offsetIndex);
        const itemKey = Math.floor((item.t + offset) / DAY_MS);
        if (itemKey !== cursorKey) break;

        let aiToAdd = getAiCount(item);
        let lastChanceToAdd = item.last_chance;
        let zeroEtvToAdd = getZeroEtvCount(item);

        if (filter === 'zeroEtv') {
          aiToAdd = 0;
          lastChanceToAdd = 0;
        } else if (filter === 'afa') {
          aiToAdd = 0;
          zeroEtvToAdd = 0;
        }

        ai += aiToAdd;
        lastChance += lastChanceToAdd;
        zeroEtv += zeroEtvToAdd;
        historyIndex += 1;
      }

      results.push({
        date: dayKeyToStart[cursorKey - startKey],
        ai,
        lastChance,
        zeroEtv,
        total: ai + lastChance
      });

      cursorKey += 1;
    }

    return formatChartPoints(results, granularity);
  }

  let cursor = Math.floor(history[0].t / intervalMs) * intervalMs;
  const endBucket = Math.floor(endTime / intervalMs) * intervalMs;
  let historyIndex = 0;

  while (cursor <= endBucket) {
    let ai = 0;
    let lastChance = 0;
    let zeroEtv = 0;
    const bucketEnd = cursor + intervalMs;

    while (historyIndex < history.length && history[historyIndex].t < bucketEnd) {
      const item = history[historyIndex];

      if (item.t >= cursor) {
        let aiToAdd = getAiCount(item);
        let lastChanceToAdd = item.last_chance;
        let zeroEtvToAdd = getZeroEtvCount(item);

        if (filter === 'zeroEtv') {
          aiToAdd = 0;
          lastChanceToAdd = 0;
        } else if (filter === 'afa') {
          aiToAdd = 0;
          zeroEtvToAdd = 0;
        }

        ai += aiToAdd;
        lastChance += lastChanceToAdd;
        zeroEtv += zeroEtvToAdd;
      }

      historyIndex += 1;
    }

    results.push({
      date: cursor,
      ai,
      lastChance,
      zeroEtv,
      total: ai + lastChance
    });

    cursor += intervalMs;
  }

  return formatChartPoints(results, granularity);
};

export const processHeatMaps = (history: HistoryItem[], filter: DataFilter = 'all'): HeatMapData => {
  const cutoff = Date.now() - 365 * DAY_MS;
  let minTs = Number.MAX_SAFE_INTEGER;
  let maxTs = 0;

  for (const item of history) {
    if (item.t <= cutoff) continue;
    if (item.t < minTs) minTs = item.t;
    if (item.t > maxTs) maxTs = item.t;
  }

  if (minTs === Number.MAX_SAFE_INTEGER) {
    return {
      weekly: {},
      hourlyMedian: Array(7).fill(0).map(() => Array(24).fill(0)),
      hourlyMean: Array(7).fill(0).map(() => Array(24).fill(0)),
      maxDaily: 1,
      maxHourlyMedian: 1,
      maxHourlyMean: 1
    };
  }

  const segments = buildOffsetSegments(minTs - DAY_MS, maxTs + DAY_MS);
  const minOffset = getOffsetAt(minTs, segments);
  const maxOffset = getOffsetAt(maxTs, segments);
  const minLocal = minTs + minOffset;
  const maxLocal = maxTs + maxOffset;

  const getWeekKey = (localTs: number): number => {
    const d = new Date(localTs);
    const dayOfWeek = d.getUTCDay();
    const dayIndex = (dayOfWeek + 6) % 7;
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const seconds = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();
    const dayStartLocal = localTs - (((hours * 60 + minutes) * 60 + seconds) * 1000 + ms);
    const weekStartLocal = dayStartLocal - dayIndex * DAY_MS;
    return Math.floor(weekStartLocal / WEEK_MS);
  };

  const minWeekKey = getWeekKey(minLocal);
  const maxWeekKey = getWeekKey(maxLocal);
  const weekCount = Math.max(maxWeekKey - minWeekKey + 1, 1);

  const weeklyMap: Record<string, number> = {};
  const hourlySum: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  const hourlyWeekSums: number[][][] = Array(7)
    .fill(0)
    .map(() => Array(24).fill(0).map(() => Array(weekCount).fill(0)));

  const offsetIndex = { i: 0 };

  for (const item of history) {
    if (item.t <= cutoff) continue;

    const offset = getOffsetForTs(item.t, segments, offsetIndex);
    const localTs = item.t + offset;
    const d = new Date(localTs);
    const dayOfWeek = d.getUTCDay();
    const dayIndex = (dayOfWeek + 6) % 7;
    const hour = d.getUTCHours();

    let total = 0;
    if (filter === 'all') {
      total = getAiCount(item) + item.last_chance;
    } else if (filter === 'zeroEtv') {
      total = getZeroEtvCount(item);
    } else if (filter === 'afa') {
      total = item.last_chance;
    }

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
    weeklyMap[dateKey] = (weeklyMap[dateKey] || 0) + total;

    const minutes = d.getUTCMinutes();
    const seconds = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();
    const dayStartLocal = localTs - (((hour * 60 + minutes) * 60 + seconds) * 1000 + ms);
    const weekStartLocal = dayStartLocal - dayIndex * DAY_MS;
    const weekKey = Math.floor(weekStartLocal / WEEK_MS);
    const weekIndex = weekKey - minWeekKey;

    if (weekIndex >= 0 && weekIndex < weekCount) {
      hourlyWeekSums[dayIndex][hour][weekIndex] += total;
    }

    hourlySum[dayIndex][hour] += total;
  }

  const hourlyMedianMatrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  const hourlyMeanMatrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const samples = hourlyWeekSums[d][h];
      const median = calculateMedian(samples);
      hourlyMedianMatrix[d][h] = Math.round(median * 10) / 10;

      const mean = hourlySum[d][h] / weekCount;
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
