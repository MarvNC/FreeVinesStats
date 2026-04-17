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

// Register only what we need — no pie, sankey, treemap, etc.
Chart.register(BarController, BarElement, LinearScale, ChartTooltip, annotationPlugin);

// Match site typography (Inter loaded via CSS)
Chart.defaults.font.family = "'Inter', sans-serif";

interface PulseChartProps {
  data: ChartDataPoint[];
  granularity: Granularity;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const SERIES = [
  { key: 'zeroEtv',    label: '0 ETV', color: '#ef4444' },
  { key: 'lastChance', label: 'AFA',   color: '#f97316' },
  { key: 'ai',         label: 'AI',    color: '#3b82f6' },
] as const;

// Tooltip state: data comes from Chart.js callback, position from mouse events
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

  const gridMajor  = isDark ? 'rgba(148,163,184,0.10)' : 'rgba(15,23,42,0.08)';
  const axisColor  = isDark ? '#64748b' : '#94a3b8';
  const refColor   = isDark ? '#64748b' : '#94a3b8';

  // Snap back to live whenever the timeframe changes
  useEffect(() => {
    setWindowAnchor(null);
  }, [timeframe]);

  const effectiveAnchor = useMemo(() => {
    return windowAnchor ?? getLiveAnchor(timeframe);
  }, [windowAnchor, timeframe]);

  const { windowStart, windowEnd } = useMemo(() => {
    // Live view: rolling window (past N days ending today)
    // History view: calendar-snapped window for clean period navigation
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
    const { start } = getCalendarWindow(data[0].date, timeframe);
    return start;
  }, [data, timeframe]);

  const canStepBack    = data.length > 0 && windowStart > oldestWindowStart;
  const canStepForward = !isLive;

  const stepBack = useCallback(() => {
    // When stepping back from the live rolling window, anchor to the calendar
    // period containing windowStart (the earliest visible day), then go one back.
    // This ensures the first ← from "past 7 days" shows a clean prior week.
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

  // ── X-axis grid line intervals by timeframe ──────────────────────────────────
  // Major lines = prominent structural dividers (with labels where applicable).
  // Minor lines = subtle subdivision guides, no labels.
  //
  //  1d  → major every 4h PST,  minor every 1h PST
  //  7d  → major every 1d PST (midnight, with weekday label), minor every 6h PST
  //  1m  → major every 1 week PST, minor every 1d PST (midnight)
  //  3m  → major every 1 month PST, minor every 1 week PST
  //  1y  → major every 1 month PST, no minor

  const xMajorLines = useMemo(() => {
    switch (timeframe) {
      case '1d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 4);
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
      case '7d': return getPstHourAlignedTimestamps(windowStart, windowEnd, 6);
      case '1m': return getPstMidnightTimestamps(windowStart, windowEnd);
      case '3m': return getPstWeekStartTimestamps(windowStart, windowEnd);
      case '1y': return [];
      default:   return [];
    }
  }, [timeframe, windowStart, windowEnd]);

  // Map of tick timestamp → label text, used by the X scale callback.
  //
  //  1d       → tick AT each major line (every 4h):     "04:00", "08:00" …
  //  7d       → tick CENTERED in each day span:         "Mon", "Tue" …
  //  1m       → tick AT each week-start (Monday PST):   "Mar 9", "Mar 16" …
  //             (week-start is unambiguous; midpoint weekday is arbitrary)
  //  3m / 1y  → tick CENTERED in each month span:       "Jan", "Feb" …
  const xTickMap = useMemo((): Map<number, string> => {
    const map = new Map<number, string>();
    const pstDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: 'numeric' });
    const pstMonFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short' });

    if (timeframe === '1d') {
      // Label at each 4h major line
      xMajorLines.forEach(ts => map.set(ts, formatPstHourLabel(ts)));

    } else if (timeframe === '7d') {
      // Label centered in each day span
      const boundaries = [windowStart, ...xMajorLines, windowEnd];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const xMid = Math.round((boundaries[i] + boundaries[i + 1]) / 2);
        map.set(xMid, formatPstWeekdayLabel(xMid));
      }

    } else if (timeframe === '1m') {
      // Label AT each Monday week-start: "Mar 9", "Mar 16" …
      xMajorLines.forEach(ts => {
        const mon = pstMonFmt.format(new Date(ts));
        const day = pstDayFmt.format(new Date(ts));
        map.set(ts, `${mon} ${day}`);
      });

    } else if (timeframe === '3m' || timeframe === '1y') {
      // Label centered in each month span: "Jan", "Feb" …
      const boundaries = [windowStart, ...xMajorLines, windowEnd];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const xMid = Math.round((boundaries[i] + boundaries[i + 1]) / 2);
        map.set(xMid, formatPstMonthLabel(xMid));
      }
    }

    return map;
  }, [timeframe, xMajorLines, windowStart, windowEnd]);

  // Build annotation plugin config
  const annotations = useMemo(() => {
    const result: Record<string, object> = {};

    // Minor X lines — very subtle, no labels
    xMinorLines.forEach((ts) => {
      result[`xminor-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.06)',
        borderWidth: 1,
        label: { display: false },
      };
    });

    // Major X lines — more visible, solid, no labels on the line itself
    xMajorLines.forEach((ts) => {
      result[`xmajor-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.12)',
        borderWidth: 1,
        label: { display: false },
      };
    });

    return result;
  }, [xMinorLines, xMajorLines, axisColor, isDark]);

  // ── Chart.js data ────────────────────────────────────────────────────────────
  // Chart.js stacked bars with linear x scale need x values per dataset
  const chartData = useMemo((): ChartData<'bar', ScatterDataPoint[]> => {
    return {
      datasets: [
        {
          label: '0 ETV',
          data: visibleData.map(d => ({ x: d.date, y: d.zeroEtv })),
          backgroundColor: '#ef4444',
          hoverBackgroundColor: '#f87171',
          stack: 's',
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.8,
          barPercentage: 1,
        },
        {
          label: 'AFA',
          data: visibleData.map(d => ({ x: d.date, y: d.lastChance })),
          backgroundColor: '#f97316',
          hoverBackgroundColor: '#fb923c',
          stack: 's',
          borderRadius: 0,
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.8,
          barPercentage: 1,
        },
        {
          label: 'AI',
          data: visibleData.map(d => ({ x: d.date, y: d.ai })),
          backgroundColor: '#3b82f6',
          hoverBackgroundColor: '#60a5fa',
          stack: 's',
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          minBarLength: 2,
          categoryPercentage: 0.8,
          barPercentage: 1,
        },
      ],
    };
  }, [visibleData]);

  // ── Chart.js options ─────────────────────────────────────────────────────────
  const options = useMemo((): ChartOptions<'bar'> => {
    const halfStep = intervalMs / 2;
    return {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 16, left: 0, right: 0, bottom: 0 } },
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
            font: { size: 10, weight: 500 },
            maxRotation: 0,
            autoSkip: false,
            // callback returns the label for ticks we injected, empty for all others
            callback(value) {
              // Find the closest key in xTickMap (within 1s tolerance for float drift)
              const v = Number(value);
              if (xTickMap.has(v)) return xTickMap.get(v)!;
              // Scan for near match (midpoint ticks may have rounding)
              for (const [k, label] of xTickMap) {
                if (Math.abs(k - v) < 1000) return label;
              }
              return '';
            },
          },
          afterBuildTicks(axis) {
            // Replace auto-generated ticks with exactly our desired positions
            axis.ticks = Array.from(xTickMap.keys()).map(v => ({ value: v, label: '' }));
          },
          offset: false,
        },
        y: {
          stacked: true,
          position: 'right',
          grid: {
            color: gridMajor,
            lineWidth: 1,
            drawTicks: false,
          },
          border: { display: false, dash: [0] },
          ticks: {
            color: axisColor,
            font: { size: 10, weight: 500 },
            padding: 4,
          },
        },
      },
      plugins: {
        tooltip: {
          enabled: false, // use custom React tooltip
          mode: 'index',
          intersect: false,
          external(context: { chart: Chart; tooltip: TooltipModel<'bar'> }) {
            const { chart, tooltip: tip } = context;
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
  }, [windowStart, windowEnd, intervalMs, axisColor, gridMajor, granularity, annotations, visibleData, xTickMap]);


  const timeframeOptions: Option<Timeframe>[] = (['1d', '3d', '7d', '1m', '3m', '1y'] as Timeframe[]).map(tf => ({
    value: tf,
    label: tf,
  }));

  // ── Custom tooltip renderer ─────────────────────────────────────────────────
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

    // Default: top-right of cursor. Flip left when too close to right edge.
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
      </div>
    );
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">The Pulse</h2>

            {/* Step navigation */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={stepBack}
                  disabled={!canStepBack}
                  aria-label="Previous period"
                  className="flex items-center justify-center size-7 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  onClick={stepForward}
                  disabled={!canStepForward}
                  aria-label="Next period"
                  className="flex items-center justify-center size-7 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
                >
                  <ChevronRight size={16} aria-hidden="true" />
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
      <div
        ref={containerRef}
        className="h-64 w-full relative"
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
    </section>
  );
};

export default PulseChart;
