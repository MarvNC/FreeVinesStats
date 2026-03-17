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

// Register only what we need — no pie, sankey, treemap, etc.
Chart.register(BarController, BarElement, LinearScale, ChartTooltip, annotationPlugin);

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

// Tooltip state shared between Chart.js callback and React renderer
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  point: ChartDataPoint | null;
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
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, point: null });
  const containerRef = useRef<HTMLDivElement>(null);

  const gridColor  = isDark ? '#1e293b' : '#f1f5f9';
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
    const { start, end } = getCalendarWindow(effectiveAnchor, timeframe);
    return { windowStart: start, windowEnd: end };
  }, [effectiveAnchor, timeframe]);

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
    setWindowAnchor(stepWindowAnchor(effectiveAnchor, timeframe, -1));
  }, [effectiveAnchor, timeframe]);

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

  // ── Reference line annotations ──────────────────────────────────────────────
  const pstMidnightLines = useMemo(() => {
    if (granularity === '1d') return [];
    return getPstMidnightTimestamps(windowStart, windowEnd);
  }, [granularity, windowStart, windowEnd]);

  const midnightLabelMode: 'none' | 'short' | 'full' = useMemo(() => {
    if (granularity === '1d') return 'none';
    return timeframe === '1d' ? 'full' : 'short';
  }, [granularity, timeframe]);

  const showWeekMarkers  = granularity === '1d' && (timeframe === '1m' || timeframe === '3m' || timeframe === '1y');
  const showMonthMarkers = granularity === '1d' && (timeframe === '3m' || timeframe === '1y');
  const weekMarkerOpacity = timeframe === '1m' ? 0.5 : 0.25;

  const pstWeekStartLines  = useMemo(() => showWeekMarkers  ? getPstWeekStartTimestamps(windowStart, windowEnd)  : [], [showWeekMarkers, windowStart, windowEnd]);
  const pstMonthStartLines = useMemo(() => showMonthMarkers ? getPstMonthStartTimestamps(windowStart, windowEnd) : [], [showMonthMarkers, windowStart, windowEnd]);

  // Build annotation plugin config
  const annotations = useMemo(() => {
    const result: Record<string, object> = {};

    pstMidnightLines.forEach((ts) => {
      const label = midnightLabelMode !== 'none'
        ? formatMidnightLabel(ts, midnightLabelMode === 'full')
        : undefined;
      result[`midnight-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: refColor,
        borderWidth: 1.5,
        borderDash: [4, 4],
        borderDashOffset: 0,
        opacity: 0.5,
        label: label ? {
          display: true,
          content: label,
          position: 'start',
          yAdjust: 4,
          color: axisColor,
          font: { size: 9, weight: 'bold' as const },
          backgroundColor: 'transparent',
          padding: 0,
        } : { display: false },
      };
    });

    pstWeekStartLines.forEach((ts) => {
      result[`week-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: refColor,
        borderWidth: 1,
        borderDash: [4, 4],
        opacity: weekMarkerOpacity,
        label: { display: false },
      };
    });

    pstMonthStartLines.forEach((ts) => {
      result[`month-${ts}`] = {
        type: 'line',
        scaleID: 'x',
        value: ts,
        borderColor: refColor,
        borderWidth: 1.5,
        borderDash: [4, 4],
        opacity: 0.8,
        label: {
          display: true,
          content: formatMidnightLabel(ts, true),
          position: 'start',
          yAdjust: 4,
          color: axisColor,
          font: { size: 9, weight: 'bold' as const },
          backgroundColor: 'transparent',
          padding: 0,
        },
      };
    });

    return result;
  }, [pstMidnightLines, pstWeekStartLines, pstMonthStartLines, midnightLabelMode, axisColor, refColor, weekMarkerOpacity]);

  // ── Chart.js data ────────────────────────────────────────────────────────────
  // Chart.js stacked bars with linear x scale need x values per dataset
  const chartData = useMemo((): ChartData<'bar', ScatterDataPoint[]> => {
    return {
      datasets: [
        {
          label: '0 ETV',
          data: visibleData.map(d => ({ x: d.date, y: d.zeroEtv })),
          backgroundColor: '#ef4444',
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
            autoSkipPadding: 48,
            callback(value) {
              return formatChartTickLabel(Number(value), granularity);
            },
          },
          offset: false,
        },
        y: {
          stacked: true,
          position: 'right',
          grid: {
            color: gridColor,
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
          external(context: { chart: Chart; tooltip: TooltipModel<'bar'> }) {
            const { chart, tooltip: tip } = context;
            if (tip.opacity === 0) {
              setTooltip(t => t.visible ? { ...t, visible: false } : t);
              return;
            }
            const dp = tip.dataPoints?.[0];
            if (!dp) return;
            const idx = dp.dataIndex;
            const point = visibleData[idx] ?? null;
            const canvasRect = chart.canvas.getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (!containerRect) return;
            const x = canvasRect.left - containerRect.left + dp.element.x;
            const y = canvasRect.top  - containerRect.top  + dp.element.y;
            setTooltip({ visible: true, x, y, point });
          },
        },
        legend: { display: false },
        annotation: { annotations },
      },
    };
  }, [windowStart, windowEnd, intervalMs, axisColor, gridColor, granularity, annotations, visibleData]);

  const timeframeOptions: Option<Timeframe>[] = (['1d', '7d', '1m', '3m', '1y'] as Timeframe[]).map(tf => ({
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

    // Keep tooltip within container bounds
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const tooltipWidth = 160;
    const rawX = tooltip.x;
    const clampedX = Math.min(Math.max(rawX, tooltipWidth / 2 + 8), containerWidth - tooltipWidth / 2 - 8);

    return (
      <div
        className="absolute z-50 pointer-events-none"
        style={{ left: clampedX, top: tooltip.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
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
      <div ref={containerRef} className="h-64 w-full relative" onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
        <Bar<ScatterDataPoint[]> data={chartData} options={options as ChartOptions<'bar'>} />
        {renderTooltip()}
      </div>
    </section>
  );
};

export default PulseChart;
