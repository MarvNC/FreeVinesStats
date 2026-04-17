import type { DashboardStats } from '@/types';

export interface SummarySentenceStats {
  lastHour: number;
  today: number;
  todayGrowth: number;
  thisWeek: number;
}

export type PaceVariant = 'quiet' | 'hot' | 'slow' | 'steady';

export interface SummarySentenceParts {
  hourLead: string;
  hourNoun: 'item' | 'items';
  trendAbs: number;
  trendDirection: 'ahead of' | 'behind';
  paceVariant: PaceVariant;
  isPositiveTrend: boolean;
}

const getHourLead = (hour: number): string => {
  if (hour >= 5 && hour < 11) return 'Good morning.';
  if (hour >= 11 && hour < 17) return 'This afternoon,';
  if (hour >= 17 && hour < 22) return 'This evening,';
  return 'Tonight,';
};

export const getSummarySentenceParts = (
  stats: SummarySentenceStats,
  clockTs: number
): SummarySentenceParts => {
  const nowHour = new Date(clockTs).getHours();
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

  return {
    hourLead: getHourLead(nowHour),
    hourNoun: stats.lastHour === 1 ? 'item' : 'items',
    trendAbs,
    trendDirection: safeGrowth >= 0 ? 'ahead of' : 'behind',
    paceVariant,
    isPositiveTrend: safeGrowth >= 0
  };
};

const formatCount = (value: number, locale: string): string => value.toLocaleString(locale);

export const formatSummarySentenceText = (
  stats: SummarySentenceStats,
  clockTs: number,
  locale = 'en-US'
): string => {
  const parts = getSummarySentenceParts(stats, clockTs);
  const lastHour = formatCount(stats.lastHour, locale);
  const today = formatCount(stats.today, locale);
  const thisWeek = formatCount(stats.thisWeek, locale);

  let paceSentence = '';
  if (parts.paceVariant === 'quiet') {
    paceSentence = 'It is very quiet so far, with no drops yet today.';
  } else if (parts.paceVariant === 'hot') {
    paceSentence = `Today is running hot at ${today} items, ${parts.trendAbs}% ahead of its usual pace.`;
  } else if (parts.paceVariant === 'slow') {
    paceSentence = `Today is moving slower at ${today} items, ${parts.trendAbs}% behind its usual pace.`;
  } else {
    paceSentence = `Today is ${parts.trendAbs}% ${parts.trendDirection} its usual pace, with ${today} items so far.`;
  }

  return `${parts.hourLead} In the past hour, ${lastHour} ${parts.hourNoun} dropped. ${paceSentence} This week: ${thisWeek} items.`;
};

export const pickSummaryStats = (stats: DashboardStats): SummarySentenceStats => ({
  lastHour: stats.lastHour,
  today: stats.today,
  todayGrowth: stats.todayGrowth,
  thisWeek: stats.thisWeek
});
