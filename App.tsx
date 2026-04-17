import React, { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { Github, ChartNoAxesCombined, CloudOff, Clock, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { fetchStats } from './services/api';
import { StatsData, Timeframe, DashboardStats, ChartDataPoint, HeatMapData, Granularity, DataFilter } from './types';
import { processStats, processChartData, processHeatMaps } from './utils/analytics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Initialize plugins locally as well to ensure availability in component render
dayjs.extend(relativeTime);

import ThemeToggle from './components/ThemeToggle';
import useDarkMode from './hooks/useDarkMode';
import StatCard from './components/StatCard';
import SegmentedControl from './components/SegmentedControl';
import useIsMobile from './hooks/useIsMobile';

// Lazy-load below-the-fold heavy components
const PulseChart    = lazy(() => import('./components/PulseChart'));
const WeeklyActivity  = lazy(() => import('./components/WeeklyActivity'));
const HourlyIntensity = lazy(() => import('./components/HourlyIntensity'));

// Skeleton placeholder that matches the final card shape to prevent CLS
const CardSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 ${height} w-full animate-pulse`} />
);

const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

const App: React.FC = () => {
  const [rawData, setRawData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [dataFilter, setDataFilter] = useState<DataFilter>('all');
  const isMobile = useIsMobile();
  const [, setTheme, theme] = useDarkMode();

  // Auto-derive granularity to optimize chart readability across devices
  const granularity = useMemo((): Granularity => {
    switch (timeframe) {
      case '1d': return isMobile ? '30m' : '15m'; // ~48 vs 96 bars
      case '3d': return isMobile ? '1h' : '30m';   // ~72 vs 144 bars
      case '7d': return isMobile ? '4h' : '1h';   // ~42 vs 168 bars
      case '1m': return '1d';                     // ~30 bars
      case '3m': return '1d';                     // ~90 bars
      case '1y': return '1d';                     // ~365 bars (handled well by chart density)
      default: return '1d';
    }
  }, [timeframe, isMobile]);

  const loadData = useCallback(async () => {
    const fetchStart = performance.now();
    try {
      setLoading(true);
      const data = await fetchStats();
      console.log(`[Perf] API Fetch & Parse: ${(performance.now() - fetchStart).toFixed(2)} ms`);
      console.log(`[Perf] Data Size: ${data.history.length} items`);
      setRawData(data);
      setError(null);
    } catch (err) {
      console.log(`[Perf] API Fetch & Parse failed after: ${(performance.now() - fetchStart).toFixed(2)} ms`);
      setError('Failed to load stats. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      if (key === '1') setTimeframe('1d');
      if (key === '2') setTimeframe('3d');
      if (key === '3') setTimeframe('7d');
      if (key === '4') setTimeframe('1m');
      if (key === '5') setTimeframe('3m');
      if (key === '6') setTimeframe('1y');
      if (key === 'r') {
        e.preventDefault();
        loadData();
      }
      if (key === 'd') {
        e.preventDefault();
        if (theme === 'system') setTheme('light');
        else if (theme === 'light') setTheme('dark');
        else setTheme('system');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadData, theme, setTheme]);

  const dashboardStats: DashboardStats = useMemo(() => {
    if (!rawData) return { lastHour: 0, today: 0, todayGrowth: 0, todayMedian: 0, thisWeek: 0, weekGrowth: 0, weekMedian: 0, updatedAt: null };
    const start = performance.now();
    const result = processStats(rawData.history, rawData.meta.updatedAt);
    console.log(`[Perf] processStats: ${(performance.now() - start).toFixed(2)} ms`);
    return result;
  }, [rawData]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!rawData) return [];
    const start = performance.now();
    const result = processChartData(rawData.history, granularity, dataFilter);
    console.log(`[Perf] processChartData: ${(performance.now() - start).toFixed(2)} ms`);
    return result;
  }, [rawData, granularity, dataFilter]);

  const heatMapData: HeatMapData = useMemo(() => {
    if (!rawData) return { weekly: {}, hourlyMedian: [], hourlyMean: [], maxDaily: 1, maxHourlyMedian: 1, maxHourlyMean: 1 };
    const start = performance.now();
    const result = processHeatMaps(rawData.history, dataFilter);
    console.log(`[Perf] processHeatMaps: ${(performance.now() - start).toFixed(2)} ms`);
    return result;
  }, [rawData, dataFilter]);

  if (loading && !rawData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary"></div>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">Loading stats…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background-light dark:bg-background-dark text-slate-500">
        <CloudOff size={36} className="text-rose-400" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pb-16 transition-colors duration-500">
      <header className="w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 sm:size-12 bg-white dark:bg-slate-800 text-primary border border-primary/20 rounded-2xl flex items-center justify-center shadow-soft">
            <ChartNoAxesCombined size={20} className="text-primary sm:hidden" />
            <ChartNoAxesCombined size={24} className="text-primary hidden sm:block" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
            FreeVinesStats
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {dashboardStats.updatedAt && (
            <>
              {/* Mobile: pulsing dot only */}
              <div className="sm:hidden flex items-center justify-center h-8 w-8 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700"
                title={`Updated ${dayjs(dashboardStats.updatedAt).fromNow()}`}
                aria-label={`Data updated ${dayjs(dashboardStats.updatedAt).fromNow()}`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
              </div>
              {/* Desktop: dot + text */}
              <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700" aria-live="polite">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Updated {dayjs(dashboardStats.updatedAt).fromNow()}
                </span>
              </div>
              <button 
                onClick={loadData} 
                className="flex items-center justify-center h-8 w-8 sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
                aria-label="Refresh data (Keyboard shortcut: R)"
                title="Refresh data (R)"
              >
                <RefreshCw size={14} className="text-slate-500 dark:text-slate-400 group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="w-full max-w-6xl px-6 flex flex-col gap-6">
        {/* Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard 
            title="Last Hour" 
            value={dashboardStats.lastHour} 
            subValue="New Items" 
            icon={Clock}
            iconColorClass="text-primary"
          />
          <StatCard 
            title="Today (PST)" 
            value={dashboardStats.today} 
            subValue={`vs Median (${dashboardStats.todayMedian})`}
            trend={dashboardStats.todayGrowth}
            trendLabel="vs Median"
            icon={TrendingUp}
            iconColorClass="text-emerald-500"
          />
          <StatCard 
            title="This Week (PST)" 
            value={dashboardStats.thisWeek} 
            subValue={`vs Median (${dashboardStats.weekMedian})`}
            trend={dashboardStats.weekGrowth}
            trendLabel="vs Median"
            icon={Calendar}
            iconColorClass="text-violet-500"
          />
        </section>

        {/* Data filter */}
        <div className="flex justify-center w-full">
          <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <SegmentedControl 
              options={[
                { value: 'all', label: 'All Items' },
                { value: 'zeroEtv', label: '0 ETV' },
                { value: 'afa', label: 'AFA' },
              ]}
              value={dataFilter}
              onChange={(val) => setDataFilter(val as DataFilter)}
              name="dataFilter"
              variant="flat"
            />
          </div>
        </div>

        {/* Pulse Chart */}
        <Suspense fallback={<CardSkeleton height="h-96" />}>
          <PulseChart 
            data={chartData} 
            granularity={granularity}
            timeframe={timeframe} 
            onTimeframeChange={setTimeframe} 
          />
        </Suspense>

        {/* Heatmaps */}
        <section className="flex flex-col gap-6 w-full">
          <Suspense fallback={<CardSkeleton height="h-64" />}>
            <WeeklyActivity data={heatMapData.weekly} maxDaily={heatMapData.maxDaily} />
          </Suspense>
          <Suspense fallback={<CardSkeleton height="h-64" />}>
            <HourlyIntensity 
              medianData={heatMapData.hourlyMedian} 
              meanData={heatMapData.hourlyMean}
              maxMedian={heatMapData.maxHourlyMedian}
              maxMean={heatMapData.maxHourlyMean}
            />
          </Suspense>
        </section>
      </main>

      <footer className="w-full max-w-6xl px-6 pt-12 pb-4 flex flex-col items-center justify-center gap-4 text-center text-slate-400 dark:text-slate-500">
        <a 
          href="https://github.com/MarvNC/FreeVinesStats" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          aria-label="View source on GitHub"
        >
          <Github size={20} />
          <span className="text-sm font-medium">By MarvNC</span>
        </a>
        <p className="text-xs">
          Data from{' '}
          <a href="https://www.vinehelper.ovh/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">VineHelper</a>.{' '}
          <a href="https://www.patreon.com/VineHelper" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Support VineHelper</a>{' '}
          if you enjoy this data.
        </p>
      </footer>
    </div>
  );
};

export default App;
