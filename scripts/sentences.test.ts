import { describe, expect, it } from 'bun:test';

import { formatSummarySentenceText, getSummarySentenceParts } from '../utils/sentences';
import type { SummarySentenceStats } from '../utils/sentences';

const MORNING_TS = new Date(2026, 3, 17, 7, 0, 0, 0).getTime();
const AFTERNOON_TS = new Date(2026, 3, 17, 13, 0, 0, 0).getTime();
const EVENING_TS = new Date(2026, 3, 17, 19, 0, 0, 0).getTime();
const NIGHT_TS = new Date(2026, 3, 17, 23, 0, 0, 0).getTime();

const assertSentenceQuality = (sentence: string): void => {
  expect(sentence).toMatch(/^[A-Z]/);
  expect(sentence).toMatch(/items?\./);
  expect(sentence).not.toMatch(/\s{2,}/);
  expect(sentence).not.toMatch(/\biT\b|\bTODAY\b|,\s+In\s+the\s+last\s+hour/);
  expect(sentence).toContain('last hour');
  expect(sentence).toContain('for this time of day');
  expect(sentence).not.toContain('its usual pace');
  expect(sentence).toContain('This week');
  expect(sentence).toMatch(/\.$/);
};

describe('summary sentence copy', () => {
  it('matches copywriter quiet template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 0,
      today: 0,
      todayGrowth: -20,
      thisWeek: 12
    };

    const sentence = formatSummarySentenceText(stats, MORNING_TS);
    expect(sentence).toBe(
      'In the last hour, 0 items were added. So far today, 0 items have appeared, which is 20% below usual pace for this time of day. This week stands at 12 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('matches copywriter strong positive template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 42,
      today: 1_234,
      todayGrowth: 67,
      thisWeek: 9_876
    };

    const sentence = formatSummarySentenceText(stats, AFTERNOON_TS);
    expect(sentence).toBe(
      'In the last hour, 42 items were added. Today is running 67% above usual for this time of day, with 1,234 items so far. This week is now at 9,876 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('matches copywriter strong negative template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 9,
      today: 130,
      todayGrowth: -41,
      thisWeek: 1_500
    };

    const sentence = formatSummarySentenceText(stats, EVENING_TS);
    expect(sentence).toBe(
      'In the last hour, 9 items were added. Today is running 41% below usual for this time of day, with 130 items so far. This week totals 1,500 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('matches copywriter neutral template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 1,
      today: 80,
      todayGrowth: 0,
      thisWeek: 400
    };

    const sentence = formatSummarySentenceText(stats, NIGHT_TS);
    expect(sentence).toBe(
      'In the last hour, 1 item was added. Today is exactly on pace for this time of day at 80 items (0%). This week is at 400 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('matches copywriter steady positive template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 4,
      today: 260,
      todayGrowth: 14,
      thisWeek: 1_040
    };

    const sentence = formatSummarySentenceText(stats, AFTERNOON_TS);
    expect(sentence).toBe(
      'In the last hour, 4 items were added. Today is modestly ahead by 14% for this time of day, with 260 items so far. This week has reached 1,040 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('matches copywriter steady negative template', () => {
    const stats: SummarySentenceStats = {
      lastHour: 2,
      today: 180,
      todayGrowth: -12,
      thisWeek: 920
    };

    const sentence = formatSummarySentenceText(stats, EVENING_TS);
    expect(sentence).toBe(
      'In the last hour, 2 items were added. Today is modestly behind by 12% for this time of day, with 180 items so far. This week is at 920 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('normalizes non-finite growth to a neutral trend', () => {
    const stats: SummarySentenceStats = {
      lastHour: 3,
      today: 200,
      todayGrowth: Number.NaN,
      thisWeek: 800
    };

    const parts = getSummarySentenceParts(stats, MORNING_TS);
    expect(parts.trendAbs).toBe(0);
    expect(parts.trendDirection).toBe('on');
    expect(parts.paceVariant).toBe('steady');

    const sentence = formatSummarySentenceText(stats, MORNING_TS);
    expect(sentence).toContain('Today is exactly on pace for this time of day at 200 items (0%).');
    assertSentenceQuality(sentence);
  });

  it('handles percentage thresholds exactly at boundaries', () => {
    const hotBoundary = getSummarySentenceParts(
      { lastHour: 2, today: 20, todayGrowth: 50, thisWeek: 100 },
      MORNING_TS
    );
    expect(hotBoundary.paceVariant).toBe('steady');

    const slowBoundary = getSummarySentenceParts(
      { lastHour: 2, today: 20, todayGrowth: -30, thisWeek: 100 },
      MORNING_TS
    );
    expect(slowBoundary.paceVariant).toBe('steady');
  });
});
