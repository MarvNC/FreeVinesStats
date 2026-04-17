import React, { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { Github, CloudOff, RefreshCw, HelpCircle, X, Info, Sprout } from 'lucide-react';
import { fetchStats } from './services/api';
import { StatsData, Timeframe, DashboardStats, ChartDataPoint, HeatMapData, Granularity, DataFilter } from './types';
import { processStats, processChartData, processHeatMaps } from './utils/analytics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Initialize plugins locally as well to ensure availability in component render
dayjs.extend(relativeTime);

import ThemeToggle from './components/ThemeToggle';
import useDarkMode from './hooks/useDarkMode';
import SegmentedControl from './components/SegmentedControl';
import useIsMobile from './hooks/useIsMobile';

// Lazy-load below-the-fold heavy components
const PulseChart    = lazy(() => import('./components/PulseChart'));
const WeeklyActivity  = lazy(() => import('./components/WeeklyActivity'));
const HourlyIntensity = lazy(() => import('./components/HourlyIntensity'));

const CardSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`border border-stone-300 dark:border-stone-700 ${height} w-full animate-pulse opacity-50`} />
);

const REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds
const LOADING_MESSAGES = [
  'Polishing the magnifying glass...',
  'Checking every shelf...',
  'Counting the good stuff...',
  'Flipping through the catalog...',
];

const formatSignedPercent = (value: number): string => {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
};

const formatTimeAgo = (updatedAt: Date, nowTs: number): string => {
  const elapsedSec = Math.max(0, Math.floor((nowTs - updatedAt.getTime()) / 1000));
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHr = Math.floor(elapsedMin / 60);
  return `${elapsedHr}h ago`;
};

const App: React.FC = () => {
  const [rawData, setRawData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [dataFilter, setDataFilter] = useState<DataFilter>('all');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [clockTick, setClockTick] = useState<number>(Date.now());
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

  useEffect(() => {
    const interval = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const loadingMessage = useMemo(() => {
    const index = Math.floor(clockTick / 2400) % LOADING_MESSAGES.length;
    return LOADING_MESSAGES[index];
  }, [clockTick]);

  const summarySentence = useMemo(() => {
    const { lastHour, today, todayGrowth, thisWeek } = dashboardStats;
    const nowHour = dayjs().hour();
    const todayFormatted = today.toLocaleString();
    const weekFormatted = thisWeek.toLocaleString();
    const trendAbs = Math.abs(todayGrowth);
    const trendDirection = todayGrowth >= 0 ? 'busier' : 'quieter';

    const opening = (() => {
      if (nowHour >= 5 && nowHour < 11) {
        return <><span className="text-stone-600 dark:text-stone-400">Good morning - </span><span className="font-bold text-stone-900 dark:text-stone-100">{lastHour.toLocaleString()}</span><span className="text-stone-600 dark:text-stone-400"> drops in the last hour. </span></>;
      }
      if (nowHour >= 11 && nowHour < 17) {
        return <><span className="text-stone-600 dark:text-stone-400">The afternoon rush brought </span><span className="font-bold text-stone-900 dark:text-stone-100">{lastHour.toLocaleString()}</span><span className="text-stone-600 dark:text-stone-400"> new items. </span></>;
      }
      if (nowHour >= 17 && nowHour < 22) {
        return <><span className="text-stone-600 dark:text-stone-400">Evening hunt: </span><span className="font-bold text-stone-900 dark:text-stone-100">{lastHour.toLocaleString()}</span><span className="text-stone-600 dark:text-stone-400"> drops in the last hour. </span></>;
      }
      return <><span className="text-stone-600 dark:text-stone-400">Night owl mode - </span><span className="font-bold text-stone-900 dark:text-stone-100">{lastHour.toLocaleString()}</span><span className="text-stone-600 dark:text-stone-400"> items just landed. </span></>;
    })();

    if (lastHour === 0) {
      return <span className="text-stone-600 dark:text-stone-400">It's been quiet - no drops in the last hour.</span>;
    }

    if (todayGrowth > 50) {
      return (
        <>
          <span className="text-stone-600 dark:text-stone-400">Today's on fire - </span>
          <span className="font-bold text-stone-900 dark:text-stone-100">{todayFormatted}</span>
          <span className="text-stone-600 dark:text-stone-400"> drops so far, a whopping </span>
          <span className="font-bold text-emerald-600">{todayGrowth}%</span>
          <span className="text-stone-600 dark:text-stone-400"> above typical!</span>
        </>
      );
    }

    if (todayGrowth < -30) {
      return (
        <>
          <span className="text-stone-600 dark:text-stone-400">Slow day - only </span>
          <span className="font-bold text-stone-900 dark:text-stone-100">{todayFormatted}</span>
          <span className="text-stone-600 dark:text-stone-400"> drops, </span>
          <span className="font-bold text-rose-500">{trendAbs}%</span>
          <span className="text-stone-600 dark:text-stone-400"> below the usual pace.</span>
        </>
      );
    }

    return (
      <>
        {opening}
        <span className="text-stone-600 dark:text-stone-400">Today's shaping up to be </span>
        <span className={`font-bold ${todayGrowth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{trendAbs}%</span>
        <span className="text-stone-600 dark:text-stone-400"> {trendDirection} than usual with </span>
        <span className="font-bold text-stone-900 dark:text-stone-100">{todayFormatted}</span>
        <span className="text-stone-600 dark:text-stone-400"> drops so far. This week we've tracked </span>
        <span className="font-bold text-stone-900 dark:text-stone-100">{weekFormatted}</span>
        <span className="text-stone-600 dark:text-stone-400">.</span>
      </>
    );
  }, [dashboardStats]);

  if (loading && !rawData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background-light dark:bg-background-dark font-sans relative">
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
        <div className="w-12 h-12 border-4 border-stone-200 dark:border-stone-800 border-t-primary rounded-full animate-spin z-10"></div>
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400 z-10">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background-light dark:bg-background-dark text-stone-600 dark:text-stone-400 font-sans px-4 text-center relative">
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
        <CloudOff size={48} className="text-rose-400 mb-2 z-10" />
        <h2 className="text-xl font-display font-bold text-stone-900 dark:text-white z-10">Unable to Load Data</h2>
        <p className="text-sm max-w-md z-10">{error}</p>
        <button 
          onClick={loadData}
          className="mt-4 px-6 py-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-medium rounded-full hover:opacity-90 transition-opacity z-10"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-16 transition-colors duration-500 font-sans relative overflow-x-hidden bg-background-light dark:bg-background-dark">
      {/* Subtle warm noise texture overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      
      {/* Header Zone */}
      <div className="w-full border-b border-stone-200 dark:border-stone-800 bg-background-light dark:bg-background-dark relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between py-6 gap-4">
            <div className="flex items-center gap-2.5 text-stone-800 dark:text-stone-100">
              <Sprout size={22} className="text-primary" strokeWidth={2.5} />
              <h1 className="text-2xl sm:text-3xl tracking-tight font-display">
                <span className="font-bold">FreeVines</span>
                <span className="font-light">Stats</span>
              </h1>
            </div>

            <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-sm font-medium text-stone-500 dark:text-stone-400">
              {dashboardStats.updatedAt && (
                <div className="flex items-center gap-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <button 
                    onClick={loadData} 
                    className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-100 transition-colors group"
                    title="Refresh data (R)"
                  >
                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-300" />
                    <span className="hidden sm:inline">Refreshed {formatTimeAgo(dashboardStats.updatedAt, clockTick)}</span>
                  </button>
                </div>
              )}
              <div className="hidden sm:block w-px h-4 bg-stone-200 dark:bg-stone-800"></div>
              <button onClick={() => setShowShortcuts(true)} className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors flex items-center gap-1.5">
                <HelpCircle size={16} />
                <span className="hidden sm:inline">Keys [?]</span>
              </button>
              <div className="hidden sm:block w-px h-4 bg-stone-200 dark:bg-stone-800"></div>
              <ThemeToggle />
            </div>
          </header>
        </div>
      </div>

      <main className="w-full flex flex-col relative z-10">
        {/* Stats Zone */}
        <section className="w-full bg-background-light dark:bg-background-dark border-b border-stone-200 dark:border-stone-800 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10">
            <p className="font-display text-xl md:text-2xl leading-relaxed max-w-5xl">
              {isMobile ? (
                <>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{dashboardStats.lastHour.toLocaleString()} new</span>
                  <span className="text-stone-600 dark:text-stone-400"> · </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{dashboardStats.today.toLocaleString()} today</span>
                  <span className="text-stone-600 dark:text-stone-400"> (</span>
                  <span className={`font-bold ${dashboardStats.todayGrowth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatSignedPercent(dashboardStats.todayGrowth)}
                  </span>
                  <span className="text-stone-600 dark:text-stone-400">) · </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{dashboardStats.thisWeek.toLocaleString()} this week</span>
                </>
              ) : summarySentence}
            </p>
          </div>
        </section>

        {/* Dashboard Controls & Chart Zone */}
        <section className="w-full bg-background-light dark:bg-background-dark border-b border-stone-200 dark:border-stone-800 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-8 pb-10">
            {/* Dedicated Control Strip for Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 font-display flex items-center gap-2">
                The Pulse
              </h2>
              <div className="flex items-center gap-2">
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
                <div className="relative group ml-1 hidden sm:block">
                  <Info size={16} className="text-stone-400 hover:text-primary cursor-help transition-colors" />
                  <div className="absolute top-full right-0 mt-2 w-56 p-4 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm rounded-xl shadow-soft border border-stone-100 dark:border-stone-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="font-semibold mb-2 border-b border-stone-100 dark:border-stone-700 pb-2">Filter Labels</p>
                    <p className="mt-2"><span className="text-primary font-medium">All Items</span> = AI Items</p>
                    <p className="mt-2"><span className="text-[#a2495c] font-medium">0 ETV</span> = $0 Tax Value</p>
                    <p className="mt-2"><span className="text-[#c9a96e] font-medium">AFA</span> = Available For All</p>
                  </div>
                </div>
              </div>
            </div>

            <Suspense fallback={<CardSkeleton height="h-96" />}>
              <PulseChart 
                data={chartData} 
                granularity={granularity}
                timeframe={timeframe} 
                onTimeframeChange={setTimeframe} 
              />
            </Suspense>
          </div>
        </section>

        {/* Heatmaps Zone - Equal grid */}
        <section className="w-full bg-background-light dark:bg-background-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
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
          </div>
        </section>
      </main>

      <div className="w-full bg-background-light dark:bg-background-dark border-t border-stone-200 dark:border-stone-800 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <footer className="w-full pt-10 pb-8 flex flex-col items-start justify-center gap-4 text-left text-stone-500 dark:text-stone-400 text-sm font-medium">
            <a
              href="https://github.com/MarvNC/FreeVinesStats"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              aria-label="View source on GitHub"
            >
              <Github size={16} />
              <span>Source // by MarvNC</span>
            </a>
            <p className="opacity-60 max-w-sm leading-relaxed mt-2">
              Tracking data from <a href="https://www.vinehelper.ovh/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">VineHelper</a>.<br />
              <a href="https://www.patreon.com/VineHelper" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Support VineHelper</a> if you enjoy this data.
            </p>
          </footer>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md transition-opacity" onClick={() => setShowShortcuts(false)} aria-modal="true" role="dialog">
          <div className="bg-background-light dark:bg-background-dark rounded-lg border border-stone-200 dark:border-stone-800 shadow-soft w-full max-w-md overflow-hidden animate-fade-in animate-zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-sm font-bold text-primary flex items-center gap-2 font-sans">
                <HelpCircle size={16} />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-[1fr_auto] gap-4 gap-y-5 text-xs font-medium font-sans">
                <div className="text-stone-600 dark:text-stone-400">Set timeframe (1d to 1y)</div>
                <div className="flex gap-1.5 justify-end font-medium tabular-nums">
                  <kbd className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-2 min-w-[1.5rem] h-6 text-stone-900 dark:text-stone-100">1</kbd>
                  <span className="text-stone-400 self-center">...</span>
                  <kbd className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-2 min-w-[1.5rem] h-6 text-stone-900 dark:text-stone-100">6</kbd>
                </div>

                <div className="text-stone-600 dark:text-stone-400">Force refresh</div>
                <div className="flex justify-end font-medium">
                  <kbd className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-2 min-w-[1.5rem] h-6 text-stone-900 dark:text-stone-100">R</kbd>
                </div>

                <div className="text-stone-600 dark:text-stone-400">Toggle theme</div>
                <div className="flex justify-end font-medium">
                  <kbd className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-2 min-w-[1.5rem] h-6 text-stone-900 dark:text-stone-100">D</kbd>
                </div>

                <div className="text-stone-600 dark:text-stone-400">Toggle help</div>
                <div className="flex justify-end font-medium">
                  <kbd className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-2 min-w-[1.5rem] h-6 text-stone-900 dark:text-stone-100">?</kbd>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-stone-200 dark:border-stone-800 text-center">
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-full py-2.5 bg-primary text-white font-medium text-sm rounded-lg transition-opacity hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
