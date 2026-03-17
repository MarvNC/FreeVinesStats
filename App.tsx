import React, { useEffect, useState, useMemo } from 'react';
import { FaGithub } from 'react-icons/fa';
import { fetchStats } from './services/api';
import { StatsData, Timeframe, DashboardStats, ChartDataPoint, HeatMapData, Granularity, DataFilter } from './types';
import { processStats, processChartData, processHeatMaps } from './utils/analytics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Initialize plugins locally as well to ensure availability in component render
dayjs.extend(relativeTime);

import ThemeToggle from './components/ThemeToggle';
import StatCard from './components/StatCard';
import PulseChart from './components/PulseChart';
import WeeklyActivity from './components/WeeklyActivity';
import HourlyIntensity from './components/HourlyIntensity';
import SegmentedControl from './components/SegmentedControl';

const App: React.FC = () => {
  const [rawData, setRawData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [granularity, setGranularity] = useState<Granularity>('1h');
  const [dataFilter, setDataFilter] = useState<DataFilter>('all');

  // Enforce Granularity Constraints
  const validGranularities = useMemo((): Granularity[] => {
    switch (timeframe) {
      case '1d': return ['15m', '1h'];
      case '7d': return ['1h', '1d'];
      case '1m': return ['1d'];
      case '3m': return ['1d'];
      case '1y': return ['1d'];
      default: return ['1d'];
    }
  }, [timeframe]);

  useEffect(() => {
    if (!validGranularities.includes(granularity)) {
      setGranularity(validGranularities[0]);
    }
  }, [timeframe, validGranularities, granularity]);

  useEffect(() => {
    const loadData = async () => {
      const fetchStart = performance.now();
      try {
        setLoading(true);
        const data = await fetchStats();
        console.log(`[Perf] API Fetch & Parse: ${(performance.now() - fetchStart).toFixed(2)} ms`);
        console.log(`[Perf] Data Size: ${data.history.length} items`);
        setRawData(data);
      } catch (err) {
        console.log(`[Perf] API Fetch & Parse failed after: ${(performance.now() - fetchStart).toFixed(2)} ms`);
        setError('Failed to load stats. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

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
        <span className="material-symbols-outlined text-4xl text-rose-400">cloud_off</span>
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pb-16 transition-colors duration-500">
      <header className="w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 sm:size-12 bg-white dark:bg-slate-800 text-primary border border-primary/20 rounded-2xl flex items-center justify-center shadow-soft">
            <span className="material-symbols-outlined text-xl sm:text-2xl">monitoring</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
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
              <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Updated {dayjs(dashboardStats.updatedAt).fromNow()}
                </span>
              </div>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="w-full max-w-6xl px-6 flex flex-col gap-6">
        {/* Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            title="Last Hour" 
            value={dashboardStats.lastHour} 
            subValue="New Items" 
            icon="schedule" 
            iconColorClass="text-primary"
          />
          <StatCard 
            title="Today (PST)" 
            value={dashboardStats.today} 
            subValue={`vs Median (${dashboardStats.todayMedian})`}
            trend={dashboardStats.todayGrowth}
            trendLabel="vs Median"
            icon="trending_up" 
            iconColorClass="text-emerald-500"
          />
          <StatCard 
            title="This Week (PST)" 
            value={dashboardStats.thisWeek} 
            subValue={`vs Median (${dashboardStats.weekMedian})`}
            trend={dashboardStats.weekGrowth}
            trendLabel="vs Median"
            icon="calendar_month" 
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
        <PulseChart 
          data={chartData} 
          granularity={granularity}
          onGranularityChange={setGranularity}
          timeframe={timeframe} 
          onTimeframeChange={setTimeframe} 
          validGranularities={validGranularities}
        />

        {/* Heatmaps */}
        <section className="flex flex-col gap-6 w-full">
          <WeeklyActivity data={heatMapData.weekly} maxDaily={heatMapData.maxDaily} />
          <HourlyIntensity 
            medianData={heatMapData.hourlyMedian} 
            meanData={heatMapData.hourlyMean}
            maxMedian={heatMapData.maxHourlyMedian}
            maxMean={heatMapData.maxHourlyMean}
          />
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
          <FaGithub className="w-5 h-5" />
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
