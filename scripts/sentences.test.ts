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
  expect(sentence).not.toMatch(/\biT\b|\bTODAY\b|\bIn\s+the\s+PAST\s+hour\b/);
  expect(sentence).toContain('In the past hour,');
  expect(sentence).toContain('This week:');
};

describe('summary sentence copy', () => {
  it('uses quiet copy when there are no drops yet today', () => {
    const stats: SummarySentenceStats = {
      lastHour: 0,
      today: 0,
      todayGrowth: -20,
      thisWeek: 12
    };

    const sentence = formatSummarySentenceText(stats, MORNING_TS);
    expect(sentence).toBe(
      'Good morning. In the past hour, 0 items dropped. It is very quiet so far, with no drops yet today. This week: 12 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('uses hot pace copy for strong positive growth', () => {
    const stats: SummarySentenceStats = {
      lastHour: 42,
      today: 1_234,
      todayGrowth: 67,
      thisWeek: 9_876
    };

    const sentence = formatSummarySentenceText(stats, AFTERNOON_TS);
    expect(sentence).toBe(
      'This afternoon, In the past hour, 42 items dropped. Today is running hot at 1,234 items, 67% ahead of its usual pace. This week: 9,876 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('uses slower pace copy for strong negative growth', () => {
    const stats: SummarySentenceStats = {
      lastHour: 9,
      today: 130,
      todayGrowth: -41,
      thisWeek: 1_500
    };

    const sentence = formatSummarySentenceText(stats, EVENING_TS);
    expect(sentence).toBe(
      'This evening, In the past hour, 9 items dropped. Today is moving slower at 130 items, 41% behind its usual pace. This week: 1,500 items.'
    );
    assertSentenceQuality(sentence);
  });

  it('uses steady pace copy and singular noun where needed', () => {
    const stats: SummarySentenceStats = {
      lastHour: 1,
      today: 80,
      todayGrowth: 0,
      thisWeek: 400
    };

    const sentence = formatSummarySentenceText(stats, NIGHT_TS);
    expect(sentence).toBe(
      'Tonight, In the past hour, 1 item dropped. Today is 0% ahead of its usual pace, with 80 items so far. This week: 400 items.'
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
    expect(parts.trendDirection).toBe('ahead of');
    expect(parts.paceVariant).toBe('steady');

    const sentence = formatSummarySentenceText(stats, MORNING_TS);
    expect(sentence).toContain('Today is 0% ahead of its usual pace');
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
