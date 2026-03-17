import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart, 
  Bar, 
  XAxis, 
  YAxis,
  CartesianGrid,
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { ChartDataPoint, Timeframe, Granularity } from '../types';
import {
  formatChartTickLabel,
  formatMidnightLabel,
  getPstMidnightTimestamps,
  getPstMonthStartTimestamps,
  getPstWeekStartTimestamps,
  getCalendarWindow,
  getLiveAnchor,
  stepWindowAnchor,
  formatWindowLabel,
} from '../utils/analytics';
import SegmentedControl, { Option } from './SegmentedControl';
import useDarkMode from '../hooks/useDarkMode';

interface PulseChartProps {
  data: ChartDataPoint[];
  granularity: Granularity;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const SERIES = [
  { key: 'zeroEtv', label: '0 ETV', color: '#ef4444' },
  { key: 'lastChance', label: 'AFA',   color: '#f97316' },
  { key: 'ai',        label: 'AI',     color: '#3b82f6' },
] as const;

const PulseChart: React.FC<PulseChartProps> = ({ 
  data, 
  granularity, 
  timeframe,
  onTimeframeChange
}) => {
  // null = live (current calendar period). A timestamp = viewing a historical period.
  const [windowAnchor, setWindowAnchor] = useState<number | null>(null);
  const [resolvedTheme] = useDarkMode();
  const isDark = resolvedTheme === 'dark';

  const gridColor    = isDark ? '#1e293b' : '#f1f5f9';
  const axisColor    = isDark ? '#64748b' : '#94a3b8';
  const cursorFill   = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)';

  // Snap back to live whenever the timeframe changes
  useEffect(() => {
    setWindowAnchor(null);
  }, [timeframe]);

  // The anchor used for window calculations — live anchor when null
  const effectiveAnchor = useMemo(() => {
    return windowAnchor ?? getLiveAnchor(timeframe);
  }, [windowAnchor, timeframe]);

  // The [start, end) UTC window being displayed
  const { windowStart, windowEnd } = useMemo(() => {
    const { start, end } = getCalendarWindow(effectiveAnchor, timeframe);
    return { windowStart: start, windowEnd: end };
  }, [effectiveAnchor, timeframe]);

  // Whether we're viewing the current live period
  const isLive = useMemo(() => {
    if (windowAnchor === null) return true;
    const liveAnchor = getLiveAnchor(timeframe);
    const { start: liveStart } = getCalendarWindow(liveAnchor, timeframe);
    return windowStart >= liveStart;
  }, [windowAnchor, timeframe, windowStart]);

  // Earliest possible window start (one window before first data point)
  const oldestWindowStart = useMemo(() => {
    if (data.length === 0) return 0;
    const { start } = getCalendarWindow(data[0].date, timeframe);
    return start;
  }, [data, timeframe]);

  const canStepBack    = data.length > 0 && windowStart > oldestWindowStart;
  const canStepForward = !isLive;

  const stepBack = useCallback(() => {
    const newAnchor = stepWindowAnchor(effectiveAnchor, timeframe, -1);
    setWindowAnchor(newAnchor);
  }, [effectiveAnchor, timeframe]);

  const stepForward = useCallback(() => {
    const newAnchor = stepWindowAnchor(effectiveAnchor, timeframe, +1);
    const liveAnchor = getLiveAnchor(timeframe);
    const { start: liveStart } = getCalendarWindow(liveAnchor, timeframe);
    const { start: newStart } = getCalendarWindow(newAnchor, timeframe);
    if (newStart >= liveStart) {
      setWindowAnchor(null); // snap to live
    } else {
      setWindowAnchor(newAnchor);
    }
  }, [effectiveAnchor, timeframe]);

  const goLive = useCallback(() => setWindowAnchor(null), []);

  // Filter data to visible window
  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    return data.filter(d => d.date >= windowStart && d.date < windowEnd);
  }, [data, windowStart, windowEnd]);

  const seriesTotals = useMemo(() => {
    return SERIES.map(s => ({
      ...s,
      total: visibleData.reduce((sum, d) => sum + ((d[s.key as keyof ChartDataPoint] as number) || 0), 0)
    }));
  }, [visibleData]);

  const intervalMs = useMemo(() => {
    switch (granularity) {
      case '15m': return 15 * 60 * 1000;
      case '1h':  return 60 * 60 * 1000;
      case '1d':  return 24 * 60 * 60 * 1000;
      default:    return 15 * 60 * 1000;
    }
  }, [granularity]);

  const xDomain = useMemo(() => {
    const halfStep = intervalMs / 2;
    // Use the window bounds so the axis always spans the full period,
    // even when visibleData is sparse or empty.
    return [windowStart - halfStep, windowEnd + halfStep] as [number, number];
  }, [windowStart, windowEnd, intervalMs]);

  const pstMidnightLines = useMemo(() => {
    if (granularity !== '1h' && granularity !== '15m') return [];
    return getPstMidnightTimestamps(windowStart, windowEnd);
  }, [granularity, windowStart, windowEnd]);

  // For sub-day granularities, label midnight lines with the day name.
  // In 7D view show short "Mon", "Tue" etc.; in 1D view show full "Mon Mar 9".
  const midnightLabelMode: 'none' | 'short' | 'full' = useMemo(() => {
    if (granularity !== '1h' && granularity !== '15m') return 'none';
    return timeframe === '1d' ? 'full' : 'short';
  }, [granularity, timeframe]);

  const showWeekMarkers  = granularity === '1d' && (timeframe === '1m' || timeframe === '3m' || timeframe === '1y');
  const showMonthMarkers = granularity === '1d' && (timeframe === '3m' || timeframe === '1y');
  const weekMarkerOpacity = timeframe === '1m' ? 0.5 : 0.25;

  const pstWeekStartLines = useMemo(() => {
    if (!showWeekMarkers) return [];
    return getPstWeekStartTimestamps(windowStart, windowEnd);
  }, [showWeekMarkers, windowStart, windowEnd]);

  const pstMonthStartLines = useMemo(() => {
    if (!showMonthMarkers) return [];
    return getPstMonthStartTimestamps(windowStart, windowEnd);
  }, [showMonthMarkers, windowStart, windowEnd]);

  // Date range label shown between the step arrows
  const windowLabel = useMemo(() => {
    return formatWindowLabel(windowStart, windowEnd, timeframe);
  }, [windowStart, windowEnd, timeframe]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as ChartDataPoint;
    const showLocalTime = granularity === '1h' || granularity === '15m';
    const dateDisplay = showLocalTime
      ? new Date(point.date).toLocaleString('en-US', { 
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : `${point.fullDate} PST`;

    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-600/80 min-w-[160px]">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">{dateDisplay}</p>
        <p className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
          {point.total.toLocaleString()} <span className="text-xs text-slate-400 font-normal">total</span>
        </p>
        <div className="flex flex-col gap-1">
          {SERIES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-block size-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                {label}
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                {(point[key as keyof ChartDataPoint] as number).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const timeframeOptions: Option<Timeframe>[] = (['1d', '7d', '1m', '3m', '1y'] as Timeframe[]).map(tf => ({
    value: tf,
    label: tf
  }));

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">The Pulse</h2>
            
            {/* Step navigation row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={stepBack}
                  disabled={!canStepBack}
                  aria-label="Previous period"
                  className="flex items-center justify-center size-7 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none select-none" aria-hidden="true">chevron_left</span>
                </button>
                <button
                  onClick={stepForward}
                  disabled={!canStepForward}
                  aria-label="Next period"
                  className="flex items-center justify-center size-7 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none select-none" aria-hidden="true">chevron_right</span>
                </button>
              </div>

              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums min-w-0 truncate">
                {windowLabel}
              </span>

              <button
                onClick={goLive}
                aria-label="Jump to current period"
                aria-hidden={isLive}
                tabIndex={isLive ? -1 : 0}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150 flex-shrink-0
                  bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300
                  hover:bg-primary/20 dark:hover:bg-primary/30
                  ${isLive ? 'opacity-0 pointer-events-none w-0 p-0 overflow-hidden' : 'opacity-100'}`}
              >
                <span className="relative flex size-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex size-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                Today
              </button>
            </div>
          </div>

          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
            {granularity === '1d'
              ? 'Daily item counts · PST calendar days'
              : 'Dashed lines mark midnight PST — when Vine drops launch'}
          </p>

          {/* Series legend with totals */}
          <div className="flex flex-wrap items-center gap-4 mt-1">
            {seriesTotals.map(({ key, label, color, total }) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                {label} <span className="font-semibold text-slate-700 dark:text-slate-300 ml-0.5">({total.toLocaleString()})</span>
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <SegmentedControl 
            options={timeframeOptions}
            value={timeframe}
            onChange={onTimeframeChange}
            name="timeframe"
            variant="elevated"
          />
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={visibleData} margin={{ top: 16, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="date" 
              type="number"
              domain={xDomain}
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: axisColor, fontSize: 10, fontWeight: 500 }} 
              tickFormatter={(v) => formatChartTickLabel(Number(v), granularity)}
              minTickGap={48}
              padding={{ left: 4, right: 4 }}
            />
            <YAxis 
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: axisColor, fontSize: 10, fontWeight: 500 }} 
              width={34}
              tickMargin={4}
            />
            {pstWeekStartLines.map((ts) => (
              <ReferenceLine
                key={`week-${ts}`}
                x={ts}
                stroke={axisColor}
                strokeDasharray="4 4"
                strokeOpacity={weekMarkerOpacity}
                strokeWidth={1}
              />
            ))}
            {pstMonthStartLines.map((ts) => (
              <ReferenceLine
                key={`month-${ts}`}
                x={ts}
                stroke={axisColor}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                strokeWidth={1.5}
                label={{
                  value: formatMidnightLabel(ts, true),
                  position: 'insideTopLeft',
                  fontSize: 9,
                  fontWeight: 700,
                  fill: axisColor,
                  offset: 4,
                }}
              />
            ))}
            {pstMidnightLines.map((ts) => (
              <ReferenceLine
                key={`midnight-${ts}`}
                x={ts}
                stroke={axisColor}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                label={midnightLabelMode !== 'none' ? {
                  value: formatMidnightLabel(ts, midnightLabelMode === 'full'),
                  position: 'insideTopLeft',
                  fontSize: 9,
                  fontWeight: 700,
                  fill: axisColor,
                  offset: 4,
                } : undefined}
              />
            ))}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill }} />
            <Bar dataKey="zeroEtv"    stackId="s" radius={[0, 0, 4, 4]} minPointSize={2} fill="#ef4444" />
            <Bar dataKey="lastChance" stackId="s" radius={[0, 0, 0, 0]} minPointSize={2} fill="#f97316" />
            <Bar dataKey="ai"         stackId="s" radius={[4, 4, 0, 0]} minPointSize={2} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default PulseChart;
