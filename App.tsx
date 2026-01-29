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
      try {
        setLoading(true);
        const data = await fetchStats();
        setRawData(data);
      } catch (err) {
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
    return processStats(rawData.history, rawData.meta.updatedAt);
  }, [rawData]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!rawData) return [];
    return processChartData(rawData.history, granularity, dataFilter);
  }, [rawData, granularity, dataFilter]);

  const heatMapData: HeatMapData = useMemo(() => {
    if (!rawData) return { weekly: {}, hourlyMedian: [], hourlyMean: [], maxDaily: 1, maxHourlyMedian: 1, maxHourlyMean: 1 };
    return processHeatMaps(rawData.history, dataFilter);
  }, [rawData, dataFilter]);

  if (loading && !rawData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pb-12 transition-colors duration-500">
      <header className="w-full max-w-6xl px-6 py-8 flex items-center justify-between text-center relative">
        <div className="flex items-center gap-3">
          <div className="size-12 bg-white text-primary border-2 border-primary/20 rounded-2xl flex items-center justify-center shadow-soft">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            FreeVinesStats
          </h1>
        </div>

        <div className="flex items-center gap-4">
            {dashboardStats.updatedAt && (
            <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Updated {dayjs(dashboardStats.updatedAt).fromNow()}
                </span>
            </div>
            )}
            <ThemeToggle />
        </div>
      </header>

      <main className="w-full max-w-6xl px-6 flex flex-col gap-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            iconColorClass="text-rose-500"
          />
        </section>

        <div className="flex justify-center w-full">
            <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <SegmentedControl 
                    options={[
                        { value: 'all', label: 'All Items' },
                        { value: 'zeroEtv', label: '0etv only' },
                        { value: 'afa', label: 'AFA only' },
                    ]}
                    value={dataFilter}
                    onChange={(val) => setDataFilter(val as DataFilter)}
                    name="dataFilter"
                    variant="flat"
                />
            </div>
        </div>

        <PulseChart 
          data={chartData} 
          granularity={granularity}
          onGranularityChange={setGranularity}
          timeframe={timeframe} 
          onTimeframeChange={setTimeframe} 
          validGranularities={validGranularities}
        />

        <section className="flex flex-col gap-8 w-full">
          <WeeklyActivity data={heatMapData.weekly} maxDaily={heatMapData.maxDaily} />
          <HourlyIntensity 
            medianData={heatMapData.hourlyMedian} 
            meanData={heatMapData.hourlyMean}
            maxMedian={heatMapData.maxHourlyMedian}
            maxMean={heatMapData.maxHourlyMean}
          />
        </section>
      </main>

      <footer className="w-full max-w-6xl px-6 py-12 flex flex-col items-center justify-center gap-6 text-center text-slate-500 dark:text-slate-400">
        <a 
          href="https://github.com/MarvNC" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="GitHub"
        >
          <FaGithub className="w-6 h-6" />
          <span className="font-medium">By MarvNC</span>
        </a>
        <p className="text-sm">
          Data from <a href="https://www.vinehelper.ovh/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">VineHelper</a>. 
          {' '}
          <a href="https://www.patreon.com/VineHelper" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Support Vinehelper</a> if you enjoy this data.
        </p>
      </footer>
    </div>
  );
};

export default App;
