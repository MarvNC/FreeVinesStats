import React, { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { Github, ChartNoAxesCombined, CloudOff, Clock, TrendingUp, Calendar, RefreshCw, HelpCircle, X, Info } from 'lucide-react';
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

const CardSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`border border-slate-300 dark:border-slate-700 ${height} w-full animate-pulse opacity-50`} />
);

const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

const App: React.FC = () => {
  const [rawData, setRawData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [dataFilter, setDataFilter] = useState<DataFilter>('all');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const isMobile = useIsMobile();
  const [, setTheme, theme] = useDarkMode();

  const granularity = useMemo((): Granularity => {
    switch (timeframe) {
      case '1d': return isMobile ? '30m' : '15m';
      case '3d': return isMobile ? '1h' : '30m';
      case '7d': return isMobile ? '4h' : '1h';
      case '1m': return '1d';
      case '3m': return '1d';
      case '1y': return '1d';
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
      if (key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (key === 'escape') {
        setShowShortcuts(false);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background-light dark:bg-background-dark font-mono">
        <div className="text-primary animate-pulse text-2xl font-bold">_</div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">INIT_SYSTEM...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background-light dark:bg-background-dark text-slate-500 font-mono">
        <CloudOff size={36} className="text-rose-400" />
        <p className="text-sm font-bold uppercase">ERR: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pb-16 transition-colors duration-500 font-sans relative overflow-x-hidden">
      {/* Scanline & Grid Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-50 bg-[linear-gradient(to_bottom,transparent_0%,transparent_50%,#000_50%,#000_100%)] [background-size:100%_4px]"></div>
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(transparent_0%,rgba(43,140,238,0.05)_50%,transparent_100%)] h-32 w-full animate-scanline opacity-30"></div>

      <div className="w-full max-w-7xl px-4 sm:px-6 md:px-8 relative z-10 flex flex-col">
        {/* Top Control Bar / Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between py-6 sm:py-8 border-b-2 border-slate-900 dark:border-slate-100 mb-2 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2">
              <ChartNoAxesCombined size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display uppercase">
              FreeVines<span className="text-primary">Stats</span>
            </h1>
          </div>

          <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400 uppercase">
            {dashboardStats.updatedAt && (
              <div className="flex items-center gap-2.5">
                <span className="text-primary font-bold text-[10px] animate-blink">_LIVE</span>
                <button 
                  onClick={loadData} 
                  className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors group"
                  title="Refresh data (R)"
                >
                  <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-300" />
                  <span className="hidden sm:inline">UPDATED {dayjs(dashboardStats.updatedAt).format('HH:mm:ss')}</span>
                </button>
              </div>
            )}
            <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
            <button onClick={() => setShowShortcuts(true)} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
              <HelpCircle size={14} />
              <span className="hidden sm:inline">KEYS</span> [?]
            </button>
            <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
            <ThemeToggle />
          </div>
        </header>

        <main className="w-full flex flex-col gap-0">
          {/* Dense Ticker Bar & Filters */}
          <section className="flex flex-col xl:flex-row xl:items-center justify-between py-5 border-b border-slate-300 dark:border-slate-700 gap-6">
            <div className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 gap-y-4">
              <StatCard 
                title="LAST_HOUR" 
                value={dashboardStats.lastHour} 
                subValue="New Items" 
                icon={Clock}
                iconColorClass="text-primary"
              />
              <div className="hidden sm:block w-px h-6 bg-slate-300 dark:bg-slate-700"></div>
              <StatCard 
                title="TODAY" 
                value={dashboardStats.today} 
                subValue={`vs Median (${dashboardStats.todayMedian})`}
                trend={dashboardStats.todayGrowth}
                icon={TrendingUp}
                iconColorClass="text-emerald-500"
              />
              <div className="hidden sm:block w-px h-6 bg-slate-300 dark:bg-slate-700"></div>
              <StatCard 
                title="THIS_WEEK" 
                value={dashboardStats.thisWeek} 
                subValue={`vs Median (${dashboardStats.weekMedian})`}
                trend={dashboardStats.weekGrowth}
                icon={Calendar}
                iconColorClass="text-violet-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">FILTER:</span>
              <SegmentedControl 
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'zeroEtv', label: '0 ETV' },
                  { value: 'afa', label: 'AFA' },
                ]}
                value={dataFilter}
                onChange={(val) => setDataFilter(val as DataFilter)}
                name="dataFilter"
                variant="flat"
              />
              <div className="relative group ml-1 hidden sm:block">
                <Info size={16} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help transition-colors" />
                <div className="absolute top-full right-0 mt-2 w-56 p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] rounded-none border border-slate-700 dark:border-slate-300 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-mono tracking-wide">
                  <p className="font-bold mb-2 border-b border-slate-700 dark:border-slate-200 pb-2">FILTER_LABELS</p>
                  <p className="mt-2"><span className="text-primary font-bold">ALL</span> = AI ITEMS (DEFAULT)</p>
                  <p className="mt-2"><span className="text-rose-400 font-bold">0_ETV</span> = $0 TAX VALUE</p>
                  <p className="mt-2"><span className="text-orange-400 font-bold">AFA</span> = AVAILABLE FOR ALL</p>
                </div>
              </div>
            </div>
          </section>

          {/* Chart Section */}
          <section className="py-8 border-b border-slate-300 dark:border-slate-700">
            <Suspense fallback={<CardSkeleton height="h-96" />}>
              <PulseChart 
                data={chartData} 
                granularity={granularity}
                timeframe={timeframe} 
                onTimeframeChange={setTimeframe} 
              />
            </Suspense>
          </section>

          {/* Heatmaps Section (2-column grid) */}
          <section className="py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <Suspense fallback={<CardSkeleton height="h-72" />}>
              <WeeklyActivity data={heatMapData.weekly} maxDaily={heatMapData.maxDaily} />
            </Suspense>
            <Suspense fallback={<CardSkeleton height="h-72" />}>
              <HourlyIntensity 
                medianData={heatMapData.hourlyMedian} 
                meanData={heatMapData.hourlyMean}
                maxMedian={heatMapData.maxHourlyMedian}
                maxMean={heatMapData.maxHourlyMean}
              />
            </Suspense>
          </section>
        </main>

        <footer className="w-full pt-16 pb-8 flex flex-col items-center justify-center gap-4 text-center text-slate-400 dark:text-slate-500 font-mono uppercase text-[10px] tracking-widest font-bold">
          <a 
            href="https://github.com/MarvNC/FreeVinesStats" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="View source on GitHub"
          >
            <Github size={16} />
            <span>SOURCE // BY MARVNC</span>
          </a>
          <p className="opacity-60 max-w-sm leading-relaxed mt-2">
            DATA STREAM FROM <a href="https://www.vinehelper.ovh/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">VINEHELPER</a>.<br />
            <a href="https://www.patreon.com/VineHelper" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SUPPORT VINEHELPER</a> IF YOU ENJOY THIS DATA.
          </p>
        </footer>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-opacity" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-none border-2 border-slate-900 dark:border-white w-full max-w-md overflow-hidden animate-fade-in animate-zoom-in-95 font-mono" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b-2 border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                <HelpCircle size={16} className="text-primary" />
                KEYBOARD_SHORTCUTS
              </h2>
              <button 
                onClick={() => setShowShortcuts(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-[1fr_auto] gap-4 gap-y-6 text-xs font-bold uppercase tracking-wider">
                <div className="text-slate-600 dark:text-slate-400">SET_TIMEFRAME_1D_TO_1Y</div>
                <div className="flex gap-1.5 justify-end font-bold tabular-nums">
                  <kbd className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none px-2 min-w-[1.5rem] h-6 text-slate-900 dark:text-white">1</kbd>
                  <span className="text-slate-400 self-center">...</span>
                  <kbd className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none px-2 min-w-[1.5rem] h-6 text-slate-900 dark:text-white">6</kbd>
                </div>

                <div className="text-slate-600 dark:text-slate-400">FORCE_REFRESH</div>
                <div className="flex justify-end font-bold">
                  <kbd className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none px-2 min-w-[1.5rem] h-6 text-slate-900 dark:text-white uppercase">R</kbd>
                </div>

                <div className="text-slate-600 dark:text-slate-400">TOGGLE_THEME</div>
                <div className="flex justify-end font-bold">
                  <kbd className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none px-2 min-w-[1.5rem] h-6 text-slate-900 dark:text-white uppercase">D</kbd>
                </div>

                <div className="text-slate-600 dark:text-slate-400">TOGGLE_HELP</div>
                <div className="flex justify-end font-bold">
                  <kbd className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none px-2 min-w-[1.5rem] h-6 text-slate-900 dark:text-white">?</kbd>
                </div>
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-4 border-t-2 border-slate-900 dark:border-white text-center">
              <button 
                onClick={() => setShowShortcuts(false)}
                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-[11px] uppercase tracking-widest transition-opacity hover:opacity-90"
              >
                ACKNOWLEDGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
