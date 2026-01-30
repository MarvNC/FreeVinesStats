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

  const gridColor = isDark ? '#334155' : '#e2e8f0'; // slate-700 : slate-200
  const axisTextColor = isDark ? '#94a3b8' : '#94a3b8'; // slate-400 (keep same or adjust)
  const cursorFill = isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.05)';

  const windowDuration = useMemo(() => {
    switch (timeframe) {
      case '1d': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '1m': return 30 * 24 * 60 * 60 * 1000;
      case '3m': return 90 * 24 * 60 * 60 * 1000;
      case '1y': return 365 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }, [timeframe]);

  const intervalMs = useMemo(() => {
    switch (granularity) {
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }, [granularity]);

  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    const firstTime = data[0].date;
    const lastTime = data[data.length - 1].date;
    const totalDuration = lastTime - firstTime;
    if (totalDuration <= windowDuration) return data;
    
    const maxStartTime = lastTime - windowDuration;
    const minStartTime = firstTime;
    const scrollableRange = maxStartTime - minStartTime;
    const currentStartTime = minStartTime + (scrollableRange * (scrollPercentage / 100));
    const alignToInterval = (ts: number) => {
      if (intervalMs <= 0) return ts;
      const offset = firstTime % intervalMs;
      return Math.floor((ts - offset) / intervalMs) * intervalMs + offset;
    };
    const alignedStartTime = Math.max(minStartTime, alignToInterval(currentStartTime));
    const currentEndTime = alignedStartTime + windowDuration;

    return data.filter(d => d.date >= alignedStartTime && d.date <= currentEndTime);
  }, [data, windowDuration, scrollPercentage, intervalMs]);

  const xDomain = useMemo(() => {
    if (visibleData.length === 0) return ['dataMin', 'dataMax'] as const;
    const halfStep = intervalMs / 2;
    const timestamps = visibleData.map(point => point.date);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    return [min - halfStep, max + halfStep] as [number, number];
  }, [visibleData, intervalMs]);

  const pstMidnightLines = useMemo(() => {
    if (granularity !== '1h' && granularity !== '15m') return [];
    if (visibleData.length === 0) return [];
    const start = visibleData[0].date;
    const end = visibleData[visibleData.length - 1].date;
    return getPstMidnightTimestamps(start, end);
  }, [granularity, visibleData]);

  const showWeekMarkers = granularity === '1d' && (timeframe === '1m' || timeframe === '3m' || timeframe === '1y');
  const showMonthMarkers = granularity === '1d' && (timeframe === '3m' || timeframe === '1y');
  const weekMarkerOpacity = timeframe === '1m' ? 0.65 : 0.3;
  const dayMarkerStyle = {
    strokeDasharray: '4 4',
    strokeOpacity: 0.9,
    strokeWidth: 1.5
  };

  const pstWeekStartLines = useMemo(() => {
    if (!showWeekMarkers) return [];
    if (visibleData.length === 0) return [];
    const start = visibleData[0].date;
    const end = visibleData[visibleData.length - 1].date;
    return getPstWeekStartTimestamps(start, end);
  }, [showWeekMarkers, visibleData]);

  const pstMonthStartLines = useMemo(() => {
    if (!showMonthMarkers) return [];
    if (visibleData.length === 0) return [];
    const start = visibleData[0].date;
    const end = visibleData[visibleData.length - 1].date;
    return getPstMonthStartTimestamps(start, end);
  }, [showMonthMarkers, visibleData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-white dark:bg-slate-700 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-600 z-50">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mb-1 uppercase tracking-wider">
             {point.fullDate} PST
          </p>
          <p className="text-sm font-extrabold text-primary mb-1">
            {point.total.toLocaleString()} <span className="text-slate-400 font-normal">items</span>
          </p>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300 flex items-center gap-2">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
            {point.zeroEtv.toLocaleString()} Zero ETV
            <span className="mx-1">•</span>
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: '#f97316' }} />
            {point.lastChance.toLocaleString()} AFA
            <span className="mx-1">•</span>
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
            {point.ai.toLocaleString()} AI
          </div>
        </div>
      );
    }
    return null;
  };

  const granularityOptions: Option<Granularity>[] = (['15m', '1h', '1d'] as Granularity[]).map(g => ({
    value: g,
    label: g,
    disabled: !validGranularities.includes(g)
  }));

  const timeframeOptions: Option<Timeframe>[] = (['1d', '7d', '1m', '3m', '1y'] as Timeframe[]).map(tf => ({
    value: tf,
    label: tf
  }));

  return (
    <section className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">The Pulse</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Drop volume trends over time</p>
        </div>
        
        <SegmentedControl 
          options={granularityOptions}
          value={granularity}
          onChange={onGranularityChange}
          name="granularity"
          variant="elevated"
        />
      </div>

      <div className="h-72 w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visibleData} margin={{ top: 10, right: 10, left: 6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="date" 
              type="number"
              domain={xDomain}
              axisLine={false} 
              tickLine={false} 
              tick={{fill: axisTextColor, fontSize: 10, fontWeight: 600}} 
              tickFormatter={(value) => formatChartTickLabel(Number(value), granularity)}
              minTickGap={30}
              padding={{ left: 6, right: 6 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: axisTextColor, fontSize: 10, fontWeight: 600}} 
              width={40}
              tickMargin={6}
            />
            {pstWeekStartLines.map((ts) => (
              <ReferenceLine
                key={`pst-week-start-${ts}`}
                x={ts}
                stroke={axisTextColor}
                strokeDasharray="6 6"
                strokeOpacity={weekMarkerOpacity}
                strokeWidth={1}
              />
            ))}
            {pstMonthStartLines.map((ts) => (
              <ReferenceLine
                key={`pst-month-start-${ts}`}
                x={ts}
                stroke={axisTextColor}
                {...dayMarkerStyle}
              />
            ))}
            {pstMidnightLines.map((ts) => (
              <ReferenceLine
                key={`pst-midnight-${ts}`}
                x={ts}
                stroke={axisTextColor}
                {...dayMarkerStyle}
              />
            ))}
            <Tooltip content={<CustomTooltip />} cursor={{fill: cursorFill}} />
            <Bar dataKey="zeroEtv" stackId="stack1" radius={[0, 0, 8, 8]} minPointSize={2} fill="#ef4444" />
            <Bar dataKey="lastChance" stackId="stack1" radius={[0, 0, 0, 0]} minPointSize={2} fill="#f97316" />
            <Bar dataKey="ai" stackId="stack1" radius={[8, 8, 0, 0]} minPointSize={2} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-slate-400 text-lg">history</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={scrollPercentage} 
            onChange={(e) => setScrollPercentage(parseInt(e.target.value))}
            className="range-slider" 
          />
          <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
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
