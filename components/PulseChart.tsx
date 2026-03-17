import React, { useState, useMemo } from 'react';
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
  getPstMidnightTimestamps,
  getPstMonthStartTimestamps,
  getPstWeekStartTimestamps
} from '../utils/analytics';
import SegmentedControl, { Option } from './SegmentedControl';
import useDarkMode from '../hooks/useDarkMode';

interface PulseChartProps {
  data: ChartDataPoint[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  validGranularities: Granularity[];
}

const SERIES = [
  { key: 'zeroEtv', label: '0 ETV', color: '#ef4444' },
  { key: 'lastChance', label: 'AFA',   color: '#f97316' },
  { key: 'ai',        label: 'AI',     color: '#3b82f6' },
] as const;

const PulseChart: React.FC<PulseChartProps> = ({ 
  data, 
  granularity, 
  onGranularityChange,
  timeframe,
  onTimeframeChange,
  validGranularities
}) => {
  const [scrollPercentage, setScrollPercentage] = useState(100);
  const [resolvedTheme] = useDarkMode();
  const isDark = resolvedTheme === 'dark';

  const gridColor    = isDark ? '#1e293b' : '#f1f5f9'; // slate-800 : slate-100
  const axisColor    = isDark ? '#64748b' : '#94a3b8'; // slate-500 : slate-400
  const cursorFill   = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)';

  const windowDuration = useMemo(() => {
    switch (timeframe) {
      case '1d': return 24 * 60 * 60 * 1000;
      case '7d': return 7  * 24 * 60 * 60 * 1000;
      case '1m': return 30 * 24 * 60 * 60 * 1000;
      case '3m': return 90 * 24 * 60 * 60 * 1000;
      case '1y': return 365* 24 * 60 * 60 * 1000;
      default:   return 24 * 60 * 60 * 1000;
    }
  }, [timeframe]);

  const intervalMs = useMemo(() => {
    switch (granularity) {
      case '15m': return 15 * 60 * 1000;
      case '1h':  return 60 * 60 * 1000;
      case '1d':  return 24 * 60 * 60 * 1000;
      default:    return 15 * 60 * 1000;
    }
  }, [granularity]);

  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    const firstTime = data[0].date;
    const lastTime  = data[data.length - 1].date;
    const totalDuration = lastTime - firstTime;
    if (totalDuration <= windowDuration) return data;
    
    const maxStartTime  = lastTime - windowDuration;
    const minStartTime  = firstTime;
    const scrollableRange = maxStartTime - minStartTime;
    const currentStartTime = minStartTime + (scrollableRange * (scrollPercentage / 100));
    const alignToInterval = (ts: number) => {
      if (intervalMs <= 0) return ts;
      const offset = firstTime % intervalMs;
      return Math.floor((ts - offset) / intervalMs) * intervalMs + offset;
    };
    const alignedStartTime = Math.max(minStartTime, alignToInterval(currentStartTime));
    const currentEndTime   = alignedStartTime + windowDuration;

    return data.filter(d => d.date >= alignedStartTime && d.date <= currentEndTime);
  }, [data, windowDuration, scrollPercentage, intervalMs]);

  const xDomain = useMemo(() => {
    if (visibleData.length === 0) return ['dataMin', 'dataMax'] as const;
    const halfStep = intervalMs / 2;
    const timestamps = visibleData.map(p => p.date);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    return [min - halfStep, max + halfStep] as [number, number];
  }, [visibleData, intervalMs]);

  const pstMidnightLines = useMemo(() => {
    if (granularity !== '1h' && granularity !== '15m') return [];
    if (visibleData.length === 0) return [];
    return getPstMidnightTimestamps(visibleData[0].date, visibleData[visibleData.length - 1].date);
  }, [granularity, visibleData]);

  const showWeekMarkers  = granularity === '1d' && (timeframe === '1m' || timeframe === '3m' || timeframe === '1y');
  const showMonthMarkers = granularity === '1d' && (timeframe === '3m' || timeframe === '1y');
  const weekMarkerOpacity = timeframe === '1m' ? 0.5 : 0.25;

  const pstWeekStartLines = useMemo(() => {
    if (!showWeekMarkers || visibleData.length === 0) return [];
    return getPstWeekStartTimestamps(visibleData[0].date, visibleData[visibleData.length - 1].date);
  }, [showWeekMarkers, visibleData]);

  const pstMonthStartLines = useMemo(() => {
    if (!showMonthMarkers || visibleData.length === 0) return [];
    return getPstMonthStartTimestamps(visibleData[0].date, visibleData[visibleData.length - 1].date);
  }, [showMonthMarkers, visibleData]);

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

  const granularityOptions: Option<Granularity>[] = (['15m', '1h', '1d'] as Granularity[]).map(g => ({
    value: g,
    label: g === '15m' ? '15m' : g === '1h' ? '1h' : '1d',
    disabled: !validGranularities.includes(g)
  }));

  const timeframeOptions: Option<Timeframe>[] = (['1d', '7d', '1m', '3m', '1y'] as Timeframe[]).map(tf => ({
    value: tf,
    label: tf
  }));

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">The Pulse</h2>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium mt-0.5">
            Dashed lines mark midnight PST — when Vine drops launch
          </p>
          {/* Series legend */}
          <div className="flex items-center gap-4 mt-2.5">
            {SERIES.map(({ key, label, color }) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
        
        <SegmentedControl 
          options={granularityOptions}
          value={granularity}
          onChange={onGranularityChange}
          name="granularity"
          variant="elevated"
        />
      </div>

      {/* Chart */}
      <div className="h-64 w-full mb-5">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={visibleData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="date" 
              type="number"
              domain={xDomain}
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: axisColor, fontSize: 10, fontWeight: 500 }} 
              tickFormatter={(v) => formatChartTickLabel(Number(v), granularity)}
              minTickGap={32}
              padding={{ left: 4, right: 4 }}
            />
            <YAxis 
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
              />
            ))}
            {pstMidnightLines.map((ts) => (
              <ReferenceLine
                key={`midnight-${ts}`}
                x={ts}
                stroke={axisColor}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                strokeWidth={1.5}
              />
            ))}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill }} />
            <Bar dataKey="zeroEtv"    stackId="s" radius={[0, 0, 4, 4]} minPointSize={2} fill="#ef4444" />
            <Bar dataKey="lastChance" stackId="s" radius={[0, 0, 0, 0]} minPointSize={2} fill="#f97316" />
            <Bar dataKey="ai"         stackId="s" radius={[4, 4, 0, 0]} minPointSize={2} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scroll + timeframe controls */}
      <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-base select-none" aria-hidden="true">history</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={scrollPercentage} 
            onChange={(e) => setScrollPercentage(parseInt(e.target.value))}
            className="range-slider"
            aria-label="Scroll through time range"
            style={{ '--pct': `${scrollPercentage}%` } as React.CSSProperties}
          />
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-base select-none" aria-hidden="true">schedule</span>
        </div>

        <div className="flex justify-center">
          <SegmentedControl 
            options={timeframeOptions}
            value={timeframe}
            onChange={onTimeframeChange}
            name="timeframe"
            variant="flat"
          />
        </div>
      </div>
    </section>
  );
};

export default PulseChart;
