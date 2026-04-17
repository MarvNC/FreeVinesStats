import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  Tooltip as ChartTooltip,
  type TooltipModel,
  type ChartData,
  type ChartOptions,
  type ScatterDataPoint,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar } from 'react-chartjs-2';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChartDataPoint, Timeframe, Granularity } from '../types';
import {
  formatPstHourLabel,
  formatPstWeekdayLabel,
  formatPstMonthLabel,
  getPstMidnightTimestamps,
  getPstHourAlignedTimestamps,
  getPstMonthStartTimestamps,
  getPstWeekStartTimestamps,
  getCalendarWindow,
  getLiveAnchor,
  getLiveWindow,
  stepWindowAnchor,
  formatWindowLabel,
} from '../utils/analytics';
import SegmentedControl, { Option } from './SegmentedControl';
import useDarkMode from '../hooks/useDarkMode';

// Register only what we need
Chart.register(BarController, BarElement, LinearScale, ChartTooltip, annotationPlugin);

// Match site typography
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

interface PulseChartProps {
  data: ChartDataPoint[];
  granularity: Granularity;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const SERIES = [
  { key: 'zeroEtv',    label: '0 ETV', color: '#9e7a7a' },
  { key: 'lastChance', label: 'AFA',   color: '#c4b896' },
  { key: 'ai',         label: 'All Items', color: '#8cb092' },
] as const;

interface TooltipState {
  visible: boolean;
  point: ChartDataPoint | null;
}

interface MousePos {
  x: number;
  y: number;
}

const PulseChart: React.FC<PulseChartProps> = ({
  data,
  granularity,
  timeframe,
  onTimeframeChange,
}) => {
  const [windowAnchor, setWindowAnchor] = useState<number | null>(null);
  const [resolvedTheme] = useDarkMode();
  const isDark = resolvedTheme === 'dark';
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, point: null });
  const [mousePos, setMousePos] = useState<MousePos>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const gridMajor  = isDark ? 'rgba(168, 162, 158, 0.10)' : 'rgba(120, 113, 108, 0.12)';
  const axisColor  = isDark ? '#94a3b8' : '#64748b';

  useEffect(() => {
    setWindowAnchor(null);
  }, [timeframe]);

  const effectiveAnchor = useMemo(() => windowAnchor ?? getLiveAnchor(timeframe), [windowAnchor, timeframe]);

  const { windowStart, windowEnd } = useMemo(() => {
    if (windowAnchor === null) {
      const { start, end } = getLiveWindow(timeframe);
      return { windowStart: start, windowEnd: end };
    }
    const { start, end } = getCalendarWindow(effectiveAnchor, timeframe);
    return { windowStart: start, windowEnd: end };
  }, [windowAnchor, effectiveAnchor, timeframe]);

  const isLive = useMemo(() => {
    if (windowAnchor === null) return true;
    const liveAnchor = getLiveAnchor(timeframe);
    const { start: liveStart } = getCalendarWindow(liveAnchor, timeframe);
    return windowStart >= liveStart;
  }, [windowAnchor, timeframe, windowStart]);

  const oldestWindowStart = useMemo(() => {
    if (data.length === 0) return 0;
    return getCalendarWindow(data[0].date, timeframe).start;
  }, [data, timeframe]);

  const canStepBack    = data.length > 0 && windowStart > oldestWindowStart;
  const canStepForward = !isLive;

  const stepBack = useCallback(() => {
    const anchorForStep = windowAnchor === null ? windowStart : effectiveAnchor;
    setWindowAnchor(stepWindowAnchor(anchorForStep, timeframe, -1));
  }, [windowAnchor, windowStart, effectiveAnchor, timeframe]);

  const stepForward = useCallback(() => {
    const newAnchor = stepWindowAnchor(effectiveAnchor, timeframe, +1);
    const liveAnchor = getLiveAnchor(timeframe);
    const { start: liveStart } = getCalendarWindow(liveAnchor, timeframe);
    const { start: newStart }  = getCalendarWindow(newAnchor, timeframe);
    setWindowAnchor(newStart >= liveStart ? null : newAnchor);
  }, [effectiveAnchor, timeframe]);

  const goLive = useCallback(() => setWindowAnchor(null), []);

  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    return data.filter(d => d.date >= windowStart && d.date < windowEnd);
  }, [data, windowStart, windowEnd]);

  const seriesTotals = useMemo(() => {
    return SERIES.map(s => ({
      ...s,
      total: visibleData.reduce((sum, d) => sum + ((d[s.key as keyof ChartDataPoint] as number) || 0), 0),
    }));
  }, [visibleData]);

  const intervalMs = useMemo(() => {
    switch (granularity) {
      case '15m': return 15 * 60 * 1000;
      case '30m': return 30 * 60 * 1000;
      case '1h':  return 60 * 60 * 1000;
      case '4h':  return  4 * 60 * 60 * 1000;
      case '1d':  return 24 * 60 * 60 * 1000;
      default:    return 15 * 60 * 1000;
    }
  }, [granularity]);

  const windowLabel = useMemo(() => formatWindowLabel(windowStart, windowEnd, timeframe), [windowStart, windowEnd, timeframe]);

  const xMajorLines = useMemo(() => {
    switch (timeframe) {
      case '1d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 4);
      case '3d': return getPstMidnightTimestamps(windowStart, windowEnd);
      case '7d': return getPstMidnightTimestamps(windowStart, windowEnd);
      case '1m': return getPstWeekStartTimestamps(windowStart, windowEnd);
      case '3m':
      case '1y': return getPstMonthStartTimestamps(windowStart, windowEnd);
      default:   return [];
    }
  }, [timeframe, windowStart, windowEnd]);

  const xMinorLines = useMemo(() => {
    switch (timeframe) {
      case '1d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 1);
      case '3d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 6);
      case '7d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 6);
      case '1m': return getPstMidnightTimestamps(windowStart, windowEnd);
      case '3m': return getPstWeekStartTimestamps(windowStart, windowEnd);
      case '1y': return [];
      default:   return [];
    }
  }, [timeframe, windowStart, windowEnd]);

  const xTickMap = useMemo((): Map<number, string> => {
    const map = new Map<number, string>();
    const pstDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: 'numeric' });
    const pstMonFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short' });

    if (timeframe === '1d') {
      xMajorLines.forEach(ts => map.set(ts, formatPstHourLabel(ts)));
    } else if (timeframe === '3d' || timeframe === '7d') {
      const interiorMidnights = Array.from(new Set(xMajorLines.filter(ts => ts > windowStart && ts < windowEnd)))
        .sort((a, b) => a - b);
      const boundaries = [windowStart, ...interiorMidnights, windowEnd];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const xMid = Math.round((boundaries[i] + boundaries[i + 1]) / 2);
        map.set(xMid, formatPstWeekdayLabel(xMid).toUpperCase());
      }
    } else if (timeframe === '1m') {
      xMajorLines.forEach(ts => {
        const mon = pstMonFmt.format(new Date(ts));
        const day = pstDayFmt.format(new Date(ts));
        map.set(ts, `${mon} ${day}`.toUpperCase());
      });
    } else if (timeframe === '3m' || timeframe === '1y') {
      const boundaries = [windowStart, ...xMajorLines, windowEnd];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const xMid = Math.round((boundaries[i] + boundaries[i + 1]) / 2);
        map.set(xMid, formatPstMonthLabel(xMid).toUpperCase());
      }
    }
    return map;
  }, [timeframe, xMajorLines, windowStart, windowEnd]);

  const annotations = useMemo(() => {
    const result: Record<string, object> = {};

    xMinorLines.forEach((ts) => {
      result[`xminor-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: isDark ? 'rgba(168, 162, 158, 0.06)' : 'rgba(120, 113, 108, 0.06)',
        borderWidth: 1,
        borderDash: [2, 2],
        label: { display: false },
      };
    });

    xMajorLines.forEach((ts) => {
      result[`xmajor-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: isDark ? 'rgba(168, 162, 158, 0.15)' : 'rgba(120, 113, 108, 0.15)',
        borderWidth: 1,
        label: { display: false },
      };
    });

    return result;
  }, [xMinorLines, xMajorLines, isDark]);

  const chartData = useMemo((): ChartData<'bar', ScatterDataPoint[]> => {
    return {
      datasets: [
        {
          label: '0 ETV',
          data: visibleData.map(d => ({ x: d.date, y: d.zeroEtv })),
          backgroundColor: '#9e7a7a',
          hoverBackgroundColor: '#af8a8a',
          stack: 's',
          borderRadius: { topLeft: 2, topRight: 2 },
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.9,
          barPercentage: 1,
        },
        {
          label: 'AFA',
          data: visibleData.map(d => ({ x: d.date, y: d.lastChance })),
          backgroundColor: '#c4b896',
          hoverBackgroundColor: '#d2c7a6',
          stack: 's',
          borderRadius: { topLeft: 2, topRight: 2 },
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.9,
          barPercentage: 1,
        },
        {
          label: 'AI',
          data: visibleData.map(d => ({ x: d.date, y: d.ai })),
          backgroundColor: '#8cb092',
          hoverBackgroundColor: '#9dc0a3',
          stack: 's',
          borderRadius: { topLeft: 2, topRight: 2 },
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.9,
          barPercentage: 1,
        },
      ],
    };
  }, [visibleData]);

  const options = useMemo((): ChartOptions<'bar'> => {
    const halfStep = intervalMs / 2;
    return {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, left: 0, right: 0, bottom: 0 } },
      hover: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          stacked: true,
          min: windowStart - halfStep,
          max: windowEnd   + halfStep,
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: axisColor,
            font: { size: 10, weight: 700, family: "'Outfit', monospace" },
            maxRotation: 0,
            autoSkip: false,
            callback(value) {
              const v = Number(value);
              if (xTickMap.has(v)) return xTickMap.get(v)!;
              for (const [k, label] of xTickMap) {
                if (Math.abs(k - v) < 1000) return label;
              }
              return '';
            },
          },
          afterBuildTicks(axis) {
            axis.ticks = Array.from(xTickMap.keys()).map(v => ({ value: v, label: '' }));
          },
        },
        y: {
          stacked: true,
          position: 'right',
          grid: {
            color: gridMajor,
            lineWidth: 1,
            drawTicks: false,
          },
          border: { display: false },
          ticks: {
            color: axisColor,
            font: { size: 10, weight: 700, family: "'Outfit', monospace" },
            padding: 8,
          },
        },
      },
      plugins: {
        tooltip: {
          enabled: false,
          mode: 'index',
          intersect: false,
          external(context: { chart: Chart; tooltip: TooltipModel<'bar'> }) {
            const { tooltip: tip } = context;
            if (tip.opacity === 0) {
              setTooltip(t => t.visible ? { visible: false, point: t.point } : t);
              return;
            }
            const dp = tip.dataPoints?.[0];
            if (!dp) return;
            const idx = dp.dataIndex;
            const point = visibleData[idx] ?? null;
            setTooltip({ visible: true, point });
          },
        },
        legend: { display: false },
        annotation: { annotations },
      },
    };
  }, [windowStart, windowEnd, intervalMs, axisColor, gridMajor, annotations, visibleData, xTickMap, isDark]);

  const timeframeOptions: Option<Timeframe>[] = (['1d', '3d', '7d', '1m', '3m', '1y'] as Timeframe[]).map((tf, i) => ({
    value: tf,
    label: tf,
    keyboardHint: String(i + 1),
  }));

  const renderTooltip = () => {
    if (!tooltip.visible || !tooltip.point) return null;
    const point = tooltip.point;
    const showLocalTime = granularity !== '1d';
    const dateDisplay = showLocalTime
      ? new Date(point.date).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : `${point.fullDate} PST`;

    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const tooltipWidth = 168;
    const gap = 14;
    const placeRight = mousePos.x + gap + tooltipWidth < containerWidth;
    const tooltipLeft = placeRight ? mousePos.x + gap : mousePos.x - gap - tooltipWidth;
    const tooltipTop = mousePos.y;

    return (
      <div
        className="absolute z-50 pointer-events-none"
        style={{ left: tooltipLeft, top: tooltipTop, transform: 'translateY(-100%)' }}
      >
        <div className="bg-stone-900/95 dark:bg-stone-100/95 text-stone-100 dark:text-stone-900 p-3 rounded-lg shadow-xl border border-stone-700 dark:border-stone-300 min-w-[160px]">
          <p className="text-[10px] font-bold opacity-60 mb-1.5">{dateDisplay}</p>
          <p className="text-base font-extrabold tabular-nums mb-2">
            {point.total.toLocaleString()} <span className="text-xs font-normal opacity-60">Total</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {SERIES.map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 opacity-80">
                  <span className="inline-block size-2" style={{ backgroundColor: color }} aria-hidden="true" />
                  {label}
                </span>
                <span className="tabular-nums">
                  {(point[key as keyof ChartDataPoint] as number).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header / Control Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-4">
            {/* Series legend with totals */}
            <div className="flex items-center gap-4 mt-1">
              {seriesTotals.map(({ key, label, color, total }) => (
                <span key={key} className="flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400">
                  <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  {label} <span className="text-stone-900 dark:text-stone-100 ml-1 tabular-nums font-semibold">{total.toLocaleString()}</span>
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400 mt-2">
            <span>{windowLabel}</span>
            <span className="opacity-50">|</span>
            <span>PST</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Step navigation */}
          <div className="flex items-center">
            <button
              onClick={stepBack}
              disabled={!canStepBack}
              aria-label="Previous period"
              className="flex items-center justify-center h-8 w-8 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goLive}
              disabled={isLive}
              aria-label="Jump to current period"
              className="flex items-center justify-center h-8 px-4 border-y border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={stepForward}
              disabled={!canStepForward}
              aria-label="Next period"
              className="flex items-center justify-center h-8 w-8 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <SegmentedControl
            options={timeframeOptions}
            value={timeframe}
            onChange={onTimeframeChange}
            name="timeframe"
            variant="flat"
          />
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="h-80 w-full relative group"
        onMouseMove={e => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setTooltip(t => ({ visible: false, point: t.point }))}
      >
        <Bar<ScatterDataPoint[]> key={resolvedTheme} data={chartData} options={options as ChartOptions<'bar'>} />
        {renderTooltip()}
      </div>
    </div>
  );
};

export default PulseChart;
