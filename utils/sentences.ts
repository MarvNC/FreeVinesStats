import type { DashboardStats } from '@/types';

export interface SummarySentenceStats {
  lastHour: number;
  today: number;
  todayGrowth: number;
  thisWeek: number;
}

export type PaceVariant = 'quiet' | 'hot' | 'slow' | 'steady';

export interface SummarySentenceParts {
  hourNoun: 'item' | 'items';
  hourVerb: 'was' | 'were';
  trendAbs: number;
  trendDirection: 'above' | 'below' | 'on';
  paceVariant: PaceVariant;
}

export interface SummarySentenceDisplay {
  firstSentence: string;
  secondSentencePrefix: string;
  trendText: string;
  secondSentenceSuffix: string;
  trendTone: 'positive' | 'negative' | 'neutral';
}

export const getSummarySentenceParts = (
  stats: SummarySentenceStats,
  _clockTs: number
): SummarySentenceParts => {
  const safeGrowth = Number.isFinite(stats.todayGrowth) ? stats.todayGrowth : 0;
  const trendAbs = Math.abs(safeGrowth);

  let paceVariant: PaceVariant = 'steady';
  if (stats.today === 0 && stats.lastHour === 0) {
    paceVariant = 'quiet';
  } else if (safeGrowth > 50) {
    paceVariant = 'hot';
  } else if (safeGrowth < -30) {
    paceVariant = 'slow';
  }

  const trendDirection: SummarySentenceParts['trendDirection'] = safeGrowth > 0 ? 'above' : safeGrowth < 0 ? 'below' : 'on';

  return {
    hourNoun: stats.lastHour === 1 ? 'item' : 'items',
    hourVerb: stats.lastHour === 1 ? 'was' : 'were',
    trendAbs,
    trendDirection,
    paceVariant
  };
};

const formatCount = (value: number, locale: string): string => value.toLocaleString(locale);

const formatPercent = (value: number): string => {
  const absValue = Math.abs(value);
  const rounded = Number.isInteger(absValue) ? absValue.toString() : absValue.toFixed(1);
  return `${rounded}%`;
};

export const formatSummarySentenceText = (
  stats: SummarySentenceStats,
  clockTs: number,
  locale = 'en-US'
): string => {
  const parts = getSummarySentenceParts(stats, clockTs);
  const lastHour = formatCount(stats.lastHour, locale);
  const today = formatCount(stats.today, locale);
  const thisWeek = formatCount(stats.thisWeek, locale);
  const trendPct = formatPercent(parts.trendAbs);
  const quietTrend = parts.trendDirection === 'above'
    ? `${trendPct} above usual pace`
    : parts.trendDirection === 'below'
      ? `${trendPct} below usual pace`
      : 'exactly on pace';

  const firstSentence = `In the last hour, ${lastHour} ${parts.hourNoun} ${parts.hourVerb} added.`;

  if (parts.paceVariant === 'quiet') {
    return `${firstSentence} So far today, ${today} items have appeared, which is ${quietTrend} for this time of day. This week stands at ${thisWeek} items.`;
  }

  if (parts.paceVariant === 'hot') {
    return `${firstSentence} Today is running ${trendPct} above usual for this time of day, with ${today} items so far. This week is now at ${thisWeek} items.`;
  }

  if (parts.paceVariant === 'slow') {
    return `${firstSentence} Today is running ${trendPct} below usual for this time of day, with ${today} items so far. This week totals ${thisWeek} items.`;
  }

  if (parts.trendDirection === 'on') {
    return `${firstSentence} Today is exactly on pace for this time of day at ${today} items (${trendPct}). This week is at ${thisWeek} items.`;
  }

  if (parts.trendDirection === 'above') {
    return `${firstSentence} Today is modestly ahead by ${trendPct} for this time of day, with ${today} items so far. This week has reached ${thisWeek} items.`;
  }

  return `${firstSentence} Today is modestly behind by ${trendPct} for this time of day, with ${today} items so far. This week is at ${thisWeek} items.`;
};

export const formatSummarySentenceDisplay = (
  stats: SummarySentenceStats,
  locale = 'en-US'
): SummarySentenceDisplay => {
  const parts = getSummarySentenceParts(stats, Date.now());
  const lastHour = formatCount(stats.lastHour, locale);
  const today = formatCount(stats.today, locale);
  const thisWeek = formatCount(stats.thisWeek, locale);
  const trendPct = formatPercent(parts.trendAbs);

  let secondSentencePrefix = `Today sits at ${today} items, `;
  const secondSentenceSuffix = `, with ${thisWeek} on the week.`;

  if (parts.paceVariant === 'quiet') {
    secondSentencePrefix = `Today is still quiet at ${today} items, `;
  }

  let trendText = 'right on usual pace';
  let trendTone: SummarySentenceDisplay['trendTone'] = 'neutral';

  if (parts.trendDirection === 'above') {
    trendText = `${trendPct} above usual pace`;
    trendTone = 'positive';
  } else if (parts.trendDirection === 'below') {
    trendText = `${trendPct} below usual pace`;
    trendTone = 'negative';
  }

  return {
    firstSentence: `In the last hour, ${lastHour} ${parts.hourNoun} ${parts.hourVerb} added.`,
    secondSentencePrefix,
    trendText,
    secondSentenceSuffix,
    trendTone
  };
};

export const pickSummaryStats = (stats: DashboardStats): SummarySentenceStats => ({
  lastHour: stats.lastHour,
  today: stats.today,
  todayGrowth: stats.todayGrowth,
  thisWeek: stats.thisWeek
});
