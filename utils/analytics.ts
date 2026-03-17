import { HistoryItem, DashboardStats, ChartDataPoint, HeatMapData, Granularity, DataFilter, Timeframe } from '../types';

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
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const LOCAL_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const getTimeZoneOffsetMs = (ts: number, formatter: Intl.DateTimeFormat = TZ_PARTS_FORMATTER): number => {
  const parts = formatter.formatToParts(new Date(ts));
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

const findOffsetTransition = (start: number, end: number, offset: number, formatter: Intl.DateTimeFormat): number => {
  let lo = start;
  let hi = end;

  while (hi - lo > MINUTE_MS) {
    const mid = Math.floor((lo + hi) / 2);
    const midOffset = getTimeZoneOffsetMs(mid, formatter);
    if (midOffset === offset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return hi;
};

const buildOffsetSegments = (startTs: number, endTs: number, formatter: Intl.DateTimeFormat = TZ_PARTS_FORMATTER): OffsetSegment[] => {
  const start = Math.min(startTs, endTs);
  const end = Math.max(startTs, endTs);
  const segments: OffsetSegment[] = [];
  let cursor = start;
  let currentOffset = getTimeZoneOffsetMs(cursor, formatter);
  let segmentStart = start;

  while (cursor + DAY_MS <= end) {
    const next = cursor + DAY_MS;
    const nextOffset = getTimeZoneOffsetMs(next, formatter);

    if (nextOffset !== currentOffset) {
      const transition = findOffsetTransition(cursor, next, currentOffset, formatter);
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

const getUtcForLocal = (localTs: number, segments: OffsetSegment[]): number => {
  for (const segment of segments) {
    const candidate = localTs - segment.offset;
    if (candidate >= segment.start && candidate < segment.end) {
      return candidate;
    }
  }

  return localTs - (segments[0]?.offset ?? 0);
};

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const buildPartMap = (ts: number): Record<string, string> => {
  const parts = TZ_PARTS_FORMATTER.formatToParts(new Date(ts));
  const partMap: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value;
    }
  }

  return partMap;
};

const buildLocalPartMap = (ts: number): Record<string, string> => {
  const parts = LOCAL_PARTS_FORMATTER.formatToParts(new Date(ts));
  const partMap: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value;
    }
  }

  return partMap;
};

const getChartLabelParts = (partMap: Record<string, string>, granularity: Granularity) => {
  const weekday = partMap.weekday;
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = partMap.hour ?? '00';
  const minute = partMap.minute ?? '00';
  const monthLabel = MONTH_SHORT[Number(month) - 1] ?? month;
  const weekdayPrefix = weekday ? `${weekday}, ` : '';

  const fullDate = granularity === '1d'
    ? `${weekdayPrefix}${year}-${month}-${day}`
    : `${weekdayPrefix}${year}-${month}-${day} ${hour}:${minute}`;

  // label is computed per-call with showWeekday flag below
  return { fullDate, weekday, monthLabel, day, hour, minute };
};

/**
 * Formats a tick label for the chart X axis.
 *
 * showWeekday controls whether the day-of-week abbreviation is prepended:
 *   - 1d granularity: always shown ("Mon Mar 9")
 *   - 1h / 15m with multi-day view (7d timeframe): shown for midnight ticks only
 *     (handled externally via ReferenceLine labels; auto-ticks show time only)
 */
export const formatChartTickLabel = (ts: number, granularity: Granularity, showWeekday = false): string => {
  if (!ts || isNaN(ts)) return '';

  const partMap = (granularity !== '1d')
    ? TZ_PARTS_FORMATTER.formatToParts(new Date(ts)).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {})
    : LOCAL_PARTS_FORMATTER.formatToParts(new Date(ts)).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  const { fullDate: _fd, weekday, monthLabel, day, hour, minute } = getChartLabelParts(partMap, granularity);

  if (granularity === '1d') {
    return showWeekday ? `${weekday} ${monthLabel} ${day}` : `${monthLabel} ${day}`;
  }

  // 1d case is already returned above, this is the remaining fallback
  return hour === '00' && minute === '00' ? `${weekday} ${day}` : `${hour}:${minute}`;
};

/**
 * Formats a short weekday label for midnight reference lines.
 * Returns e.g. "Mon" or "Mon Mar 9" depending on showDate.
 */
export const formatMidnightLabel = (ts: number, showDate = false): string => {
  if (!Number.isFinite(ts)) return '';
  const partMap = buildLocalPartMap(ts);
  const { weekday, monthLabel, day } = getChartLabelParts(partMap, '1h');
  if (showDate) return `${weekday} ${monthLabel} ${Number(day)}`;
  return weekday ?? '';
};

/** Returns "HH:00" in PST for a given timestamp (for X-axis hour labels). */
export const formatPstHourLabel = (ts: number): string => {
  if (!Number.isFinite(ts)) return '';
  const partMap = TZ_PARTS_FORMATTER.formatToParts(new Date(ts))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const h = (partMap['hour'] ?? '0').padStart(2, '0');
  return `${h}:00`;
};

/** Returns "Mon", "Tue" … in PST for a given timestamp (for X-axis day labels). */
export const formatPstWeekdayLabel = (ts: number): string => {
  if (!Number.isFinite(ts)) return '';
  const partMap = TZ_PARTS_FORMATTER.formatToParts(new Date(ts))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const { weekday } = getChartLabelParts(partMap, '1h');
  return weekday ?? '';
};

/** Returns "Jan", "Feb" … in PST for a given timestamp (for X-axis month labels). */
export const formatPstMonthLabel = (ts: number): string => {
  if (!Number.isFinite(ts)) return '';
  const partMap = TZ_PARTS_FORMATTER.formatToParts(new Date(ts))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const { monthLabel } = getChartLabelParts(partMap, '1h');
  return monthLabel ?? '';
};

export const getPstMidnightTimestamps = (startTs: number, endTs: number): number[] => {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return [];
  const start = Math.min(startTs, endTs);
  const end = Math.max(startTs, endTs);
  const segments = buildOffsetSegments(start - DAY_MS, end + DAY_MS);
  const startOffset = getOffsetAt(start, segments);
  const endOffset = getOffsetAt(end, segments);
  const startKey = Math.floor((start + startOffset) / DAY_MS);
  const endKey = Math.floor((end + endOffset) / DAY_MS);
  const midnights: number[] = [];

  for (let key = startKey; key <= endKey; key++) {
    const localMidnight = key * DAY_MS;
    const utcMidnight = getUtcForLocal(localMidnight, segments);
    if (utcMidnight >= start && utcMidnight <= end) {
      midnights.push(utcMidnight);
    }
  }

  return midnights;
};

/**
 * Returns PST-aligned timestamps every `intervalHours` hours between startTs and endTs.
 * Alignment is relative to PST midnight (00:00 PST), so e.g. intervalHours=4 gives 00/04/08/12/16/20.
 */
export const getPstHourAlignedTimestamps = (startTs: number, endTs: number, intervalHours: number): number[] => {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || intervalHours <= 0) return [];
  const start = Math.min(startTs, endTs);
  const end   = Math.max(startTs, endTs);
  const intervalMs = intervalHours * HOUR_MS;
  const segments = buildOffsetSegments(start - DAY_MS, end + DAY_MS);
  const startOffset = getOffsetAt(start, segments);
  // Find the PST midnight before start
  const startLocal = start + startOffset;
  const dayKey = Math.floor(startLocal / DAY_MS);
  const midnightLocal = dayKey * DAY_MS;
  // Walk forward in intervalMs steps from midnight
  const result: number[] = [];
  for (let localT = midnightLocal; localT <= end + startOffset + intervalMs; localT += intervalMs) {
    const utcT = getUtcForLocal(localT, segments);
    if (utcT >= start && utcT <= end) {
      result.push(utcT);
    }
  }
  return result;
};

export const getPstWeekStartTimestamps = (startTs: number, endTs: number): number[] => {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return [];
  const start = Math.min(startTs, endTs);
  const end = Math.max(startTs, endTs);
  const segments = buildOffsetSegments(start - WEEK_MS, end + WEEK_MS);
  const startOffset = getOffsetAt(start, segments);
  const endOffset = getOffsetAt(end, segments);
  const startLocal = start + startOffset;
  const endLocal = end + endOffset;
  const weekStarts: number[] = [];

  const getWeekStartLocal = (localTs: number): number => {
    const d = new Date(localTs);
    const dayOfWeek = d.getUTCDay();
    const dayIndex = (dayOfWeek + 6) % 7;
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const seconds = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();
    const dayStartLocal = localTs - (((hours * 60 + minutes) * 60 + seconds) * 1000 + ms);
    return dayStartLocal - dayIndex * DAY_MS;
  };

  let cursorLocal = getWeekStartLocal(startLocal);
  while (cursorLocal <= endLocal) {
    const utcWeekStart = getUtcForLocal(cursorLocal, segments);
    if (utcWeekStart >= start && utcWeekStart <= end) {
      weekStarts.push(utcWeekStart);
    }
    cursorLocal += WEEK_MS;
  }

  return weekStarts;
};

export const getPstMonthStartTimestamps = (startTs: number, endTs: number): number[] => {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return [];
  const start = Math.min(startTs, endTs);
  const end = Math.max(startTs, endTs);
  const buffer = 35 * DAY_MS;
  const segments = buildOffsetSegments(start - buffer, end + buffer);
  const startOffset = getOffsetAt(start, segments);
  const endOffset = getOffsetAt(end, segments);
  const startLocal = start + startOffset;
  const endLocal = end + endOffset;
  const monthStarts: number[] = [];

  const getMonthStartLocal = (localTs: number): number => {
    const d = new Date(localTs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
  };

  let cursorLocal = getMonthStartLocal(startLocal);
  while (cursorLocal <= endLocal) {
    const utcMonthStart = getUtcForLocal(cursorLocal, segments);
    if (utcMonthStart >= start && utcMonthStart <= end) {
      monthStarts.push(utcMonthStart);
    }
    const d = new Date(cursorLocal);
    cursorLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  }

  return monthStarts;
};

const formatChartPoints = (raw: ChartDataPointRaw[], granularity: Granularity): ChartDataPoint[] => {
  return raw.map(point => {
    const partMap = buildPartMap(point.date);
    const { fullDate, weekday, monthLabel, day, hour, minute } = getChartLabelParts(partMap, granularity);

    const label = granularity === '1d'
      ? `${weekday} ${monthLabel} ${day}`
      : `${hour}:${minute}`;

    return { ...point, label, fullDate };
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

  const updatedAt = new Date(updatedAtStr);
  const nowTs = Date.now();
  const rangeStart = Math.min(history[0].t, nowTs) - WEEK_MS;
  const rangeEnd = Math.max(history[history.length - 1].t, nowTs) + WEEK_MS;
  const segments = buildOffsetSegments(rangeStart, rangeEnd);
  const nowOffset = getOffsetAt(nowTs, segments);
  const localNow = nowTs + nowOffset;
  const getWeekStartLocal = (localTs: number): number => {
    const d = new Date(localTs);
    const dayOfWeek = d.getUTCDay();
    const dayIndex = (dayOfWeek + 6) % 7;
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const seconds = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();
    const dayStartLocal = localTs - (((hours * 60 + minutes) * 60 + seconds) * 1000 + ms);
    return dayStartLocal - dayIndex * DAY_MS;
  };
  const todayKey = Math.floor(localNow / DAY_MS);
  const currentWeekStartLocal = getWeekStartLocal(localNow);
  const currentWeekKey = Math.floor(currentWeekStartLocal / WEEK_MS);
  const todayStartTs = getUtcForLocal(todayKey * DAY_MS, segments);
  const weekStartTs = getUtcForLocal(currentWeekStartLocal, segments);
  const oneHourAgoTs = nowTs - HOUR_MS;

  let lastHour = 0;
  let today = 0;
  let thisWeek = 0;
  const dailyTotals: Record<number, number> = {};
  const weeklyTotals: Record<number, number> = {};
  const offsetIndex = { i: 0 };

  for (const item of history) {
    const t = item.t;
    const total = getAiCount(item) + item.last_chance;

    if (t > oneHourAgoTs) lastHour += total;
    if (t >= todayStartTs) today += total;
    if (t >= weekStartTs) thisWeek += total;

    const offset = getOffsetForTs(t, segments, offsetIndex);
    const localTs = t + offset;
    const dayKey = Math.floor(localTs / DAY_MS);
    const weekStartLocal = getWeekStartLocal(localTs);
    const weekKey = Math.floor(weekStartLocal / WEEK_MS);

    if (dayKey < todayKey) {
      dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + total;
    }

    if (weekKey < currentWeekKey) {
      weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + total;
    }
  }

  const dailyMedian = Math.round(calculateMedian(Object.values(dailyTotals)));
  const todayGrowth = dailyMedian === 0 ? 100 : Math.round(((today - dailyMedian) / dailyMedian) * 100);

  const weeklyMedian = Math.round(calculateMedian(Object.values(weeklyTotals)));
  const weekGrowth = weeklyMedian === 0 ? 100 : Math.round(((thisWeek - weeklyMedian) / weeklyMedian) * 100);

  return {
    lastHour,
    today,
    todayGrowth,
    todayMedian: dailyMedian,
    thisWeek,
    weekGrowth,
    weekMedian: weeklyMedian,
    updatedAt
  };
};

export const processChartData = (history: HistoryItem[], granularity: Granularity, filter: DataFilter = 'all'): ChartDataPoint[] => {
  if (!history.length) return [];

  const endTime = Math.max(Date.now(), history[history.length - 1].t);
  const intervalMs = granularity === '15m' ? 15 * MINUTE_MS 
                   : granularity === '30m' ? 30 * MINUTE_MS
                   : granularity === '1h' ? HOUR_MS 
                   : granularity === '2h' ? 2 * HOUR_MS
                   : granularity === '4h' ? 4 * HOUR_MS
                   : granularity === '6h' ? 6 * HOUR_MS
                   : granularity === '12h' ? 12 * HOUR_MS
                   : DAY_MS;
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

  const segments = buildOffsetSegments(minTs - DAY_MS, maxTs + DAY_MS, LOCAL_PARTS_FORMATTER);
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

// ─── Calendar-aligned window utilities (for Pulse chart step navigation) ────

/**
 * Returns the PST midnight timestamp at the start of the calendar day
 * containing `ts` (defaults to now).
 */
export const getPstDayStart = (ts: number = Date.now()): number => {
  const segments = buildOffsetSegments(ts - DAY_MS, ts + DAY_MS);
  const offset = getOffsetAt(ts, segments);
  const localTs = ts + offset;
  const dayKey = Math.floor(localTs / DAY_MS);
  return getUtcForLocal(dayKey * DAY_MS, segments);
};

/**
 * Returns the PST Monday midnight timestamp for the week containing `ts`.
 */
export const getPstWeekStartFor = (ts: number = Date.now()): number => {
  const segments = buildOffsetSegments(ts - WEEK_MS, ts + WEEK_MS);
  const offset = getOffsetAt(ts, segments);
  const localTs = ts + offset;
  const d = new Date(localTs);
  const dayOfWeek = d.getUTCDay(); // 0=Sun
  const dayIndex = (dayOfWeek + 6) % 7; // 0=Mon
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  const dayStartLocal = localTs - (((hours * 60 + minutes) * 60 + seconds) * 1000 + ms);
  const weekStartLocal = dayStartLocal - dayIndex * DAY_MS;
  return getUtcForLocal(weekStartLocal, segments);
};

/**
 * Returns the PST 1st-of-month midnight timestamp for the month containing `ts`.
 */
export const getPstMonthStartFor = (ts: number = Date.now()): number => {
  const segments = buildOffsetSegments(ts - 35 * DAY_MS, ts + 35 * DAY_MS);
  const offset = getOffsetAt(ts, segments);
  const localTs = ts + offset;
  const d = new Date(localTs);
  const monthStartLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
  return getUtcForLocal(monthStartLocal, segments);
};

/**
 * Steps a PST day-start forward or backward by `n` calendar days.
 */
export const stepPstDay = (dayStartTs: number, n: number): number => {
  // Walk n days in local time, then convert back to UTC
  const buffer = (Math.abs(n) + 2) * DAY_MS;
  const segments = buildOffsetSegments(dayStartTs - buffer, dayStartTs + buffer);
  const offset = getOffsetAt(dayStartTs, segments);
  const localTs = dayStartTs + offset;
  const newLocalTs = localTs + n * DAY_MS;
  return getUtcForLocal(newLocalTs, segments);
};

/**
 * Steps a PST week-start forward or backward by `n` calendar weeks.
 */
export const stepPstWeek = (weekStartTs: number, n: number): number => {
  const buffer = (Math.abs(n) + 1) * WEEK_MS;
  const segments = buildOffsetSegments(weekStartTs - buffer, weekStartTs + buffer);
  const offset = getOffsetAt(weekStartTs, segments);
  const localTs = weekStartTs + offset;
  const newLocalTs = localTs + n * WEEK_MS;
  return getUtcForLocal(newLocalTs, segments);
};

/**
 * Steps a PST month-start forward or backward by `n` calendar months.
 */
export const stepPstMonth = (monthStartTs: number, n: number): number => {
  const buffer = 35 * DAY_MS;
  const segments = buildOffsetSegments(monthStartTs - buffer, monthStartTs + buffer + Math.abs(n) * 35 * DAY_MS);
  const offset = getOffsetAt(monthStartTs, segments);
  const localTs = monthStartTs + offset;
  const d = new Date(localTs);
  const newMonthLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 0, 0, 0, 0);
  return getUtcForLocal(newMonthLocal, segments);
};

export interface CalendarWindow {
  start: number; // inclusive
  end: number;   // exclusive (= start of next period)
}

/**
 * Returns the [start, end) UTC timestamps for the calendar window
 * whose period starts at `anchorTs` for the given timeframe.
 *
 * - 1D: one calendar day (midnight–midnight PST)
 * - 7D: one calendar week (Mon–Mon PST)
 * - 1M: one calendar month (1st–1st PST)
 * - 3M: three calendar months (1st–1st PST)
 * - 1Y: twelve calendar months (1st–1st PST, rolling from anchor month)
 */
export const getCalendarWindow = (anchorTs: number, timeframe: Timeframe): CalendarWindow => {
  switch (timeframe) {
    case '1d': {
      const start = getPstDayStart(anchorTs);
      const end = stepPstDay(start, 1);
      return { start, end };
    }
    case '7d': {
      const start = getPstWeekStartFor(anchorTs);
      const end = stepPstWeek(start, 1);
      return { start, end };
    }
    case '1m': {
      const start = getPstMonthStartFor(anchorTs);
      const end = stepPstMonth(start, 1);
      return { start, end };
    }
    case '3m': {
      const start = getPstMonthStartFor(anchorTs);
      const end = stepPstMonth(start, 3);
      return { start, end };
    }
    case '1y': {
      const start = getPstMonthStartFor(anchorTs);
      const end = stepPstMonth(start, 12);
      return { start, end };
    }
    default: {
      const start = getPstDayStart(anchorTs);
      const end = stepPstDay(start, 1);
      return { start, end };
    }
  }
};

/**
 * Steps the window anchor for a given timeframe forward (n=+1) or backward (n=-1).
 */
export const stepWindowAnchor = (anchorTs: number, timeframe: Timeframe, n: number): number => {
  switch (timeframe) {
    case '1d':  return stepPstDay(getPstDayStart(anchorTs), n);
    case '7d':  return stepPstWeek(getPstWeekStartFor(anchorTs), n);
    case '1m':  return stepPstMonth(getPstMonthStartFor(anchorTs), n);
    case '3m':  return stepPstMonth(getPstMonthStartFor(anchorTs), n);
    case '1y':  return stepPstMonth(getPstMonthStartFor(anchorTs), n);
    default:    return stepPstDay(getPstDayStart(anchorTs), n);
  }
};

/**
 * Returns the "live" anchor for a timeframe — the start of the current
 * calendar period (today, this week, this month, etc.).
 * Used only for history navigation snapping.
 */
export const getLiveAnchor = (timeframe: Timeframe): number => {
  const now = Date.now();
  switch (timeframe) {
    case '1d':  return getPstDayStart(now);
    case '7d':  return getPstWeekStartFor(now);
    case '1m':  return getPstMonthStartFor(now);
    case '3m':  return getPstMonthStartFor(now);
    case '1y':  return getPstMonthStartFor(now);
    default:    return getPstDayStart(now);
  }
};

/**
 * Returns a rolling live window ending at the end of the current PST day.
 * This is used as the default "live" view for each timeframe:
 *   1d  → today (PST calendar day, unchanged)
 *   7d  → past 7 calendar days (today + 6 days back)
 *   1m  → past 30 calendar days
 *   3m  → past 90 calendar days
 *   1y  → past 365 calendar days
 */
export const getLiveWindow = (timeframe: Timeframe): CalendarWindow => {
  const now = Date.now();
  const todayStart = getPstDayStart(now);
  const todayEnd   = stepPstDay(todayStart, 1);
  switch (timeframe) {
    case '1d':  return { start: todayStart, end: todayEnd };
    case '7d':  return { start: stepPstDay(todayStart, -6), end: todayEnd };
    case '1m':  return { start: stepPstDay(todayStart, -29), end: todayEnd };
    case '3m':  return { start: stepPstDay(todayStart, -89), end: todayEnd };
    case '1y':  return { start: stepPstDay(todayStart, -364), end: todayEnd };
    default:    return { start: todayStart, end: todayEnd };
  }
};

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

/** Extracts PST date parts for labelling (year, month 0-based, day, weekday 0=Sun). */
const getPstDateParts = (ts: number): { year: number; month: number; day: number; weekday: number } => {
  const parts = TZ_PARTS_FORMATTER.formatToParts(new Date(ts));
  let year = 0, month = 0, day = 0, weekday = 0;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (const p of parts) {
    if (p.type === 'year')    year    = Number(p.value);
    if (p.type === 'month')   month   = Number(p.value) - 1;
    if (p.type === 'day')     day     = Number(p.value);
    if (p.type === 'weekday') weekday = weekdayMap[p.value] ?? 0;
  }
  return { year, month, day, weekday };
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a human-readable date-range label for the chart nav bar.
 * Examples:
 *   1D  → "Mon, Mar 16"
 *   7D  → "Mar 10 – 16" or "Feb 24 – Mar 2"
 *   1M  → "March 2026"
 *   3M  → "Jan – Mar 2026" or "Nov 2025 – Jan 2026"
 *   1Y  → "Apr 2025 – Mar 2026"
 */
export const formatWindowLabel = (start: number, end: number, timeframe: Timeframe): string => {
  const s = getPstDateParts(start);
  // `end` is exclusive, so the last day displayed is end - 1 day
  const endDisplay = end - 1;
  const e = getPstDateParts(endDisplay);

  switch (timeframe) {
    case '1d': {
      return `${WEEKDAY_SHORT[s.weekday]}, ${MONTH_SHORT[s.month]} ${s.day}`;
    }
    case '7d': {
      if (s.month === e.month && s.year === e.year) {
        return `${MONTH_SHORT[s.month]} ${s.day} – ${e.day}`;
      }
      if (s.year === e.year) {
        return `${MONTH_SHORT[s.month]} ${s.day} – ${MONTH_SHORT[e.month]} ${e.day}`;
      }
      return `${MONTH_SHORT[s.month]} ${s.day} ${s.year} – ${MONTH_SHORT[e.month]} ${e.day} ${e.year}`;
    }
    case '1m': {
      return `${MONTH_LONG[s.month]} ${s.year}`;
    }
    case '3m': {
      if (s.year === e.year) {
        return `${MONTH_SHORT[s.month]} – ${MONTH_SHORT[e.month]} ${s.year}`;
      }
      return `${MONTH_SHORT[s.month]} ${s.year} – ${MONTH_SHORT[e.month]} ${e.year}`;
    }
    case '1y': {
      if (s.year === e.year) {
        return `${MONTH_SHORT[s.month]} – ${MONTH_SHORT[e.month]} ${s.year}`;
      }
      return `${MONTH_SHORT[s.month]} ${s.year} – ${MONTH_SHORT[e.month]} ${e.year}`;
    }
    default: {
      return `${MONTH_SHORT[s.month]} ${s.day}`;
    }
  }
};
