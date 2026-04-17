import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown, Flame } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  subValue: string;
  trend?: number; // percentage
  trendLabel?: string;
  icon: LucideIcon;
  iconColorClass: string;
  trendReverse?: boolean; // if true, positive is bad (not used here but good for future)
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  trendLabel, 
  icon: Icon, 
  iconColorClass
}) => {
  const isPositive = trend !== undefined && trend >= 0;
  // Soften badge when data is too sparse for a meaningful trend
  const isLowData = value <= 3 && trend !== undefined && trend <= -80;
  const isExtremeTrend = trend !== undefined && trend >= 100;
  const trendColorBg = isLowData
    ? 'bg-slate-100 dark:bg-slate-700'
    : isExtremeTrend
    ? 'bg-orange-100 dark:bg-orange-900/60'
    : isPositive ? 'bg-emerald-100 dark:bg-emerald-900/60' : 'bg-rose-100 dark:bg-rose-900/60';
  const trendColorText = isLowData
    ? 'text-slate-400 dark:text-slate-500'
    : isExtremeTrend
    ? 'text-orange-700 dark:text-orange-300'
    : isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300';

  const prevValueRef = React.useRef(value);
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => {
    const prev = prevValueRef.current;
    if (prev > 0) {
      const diff = Math.abs(value - prev) / prev;
      if (diff > 0.05) {
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 300);
        return () => clearTimeout(timer);
      }
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between h-full relative overflow-hidden group hover:shadow-[0_0_20px_-5px_rgba(43,140,238,0.3)] dark:hover:shadow-[0_0_20px_-5px_rgba(43,140,238,0.2)] hover:-translate-y-0.5 transition-all duration-200 gap-4 min-h-[140px]`}>
      
      {/* Decorative background icon - Desktop only */}
      <div className={`absolute right-0 top-0 p-3 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity select-none pointer-events-none hidden sm:block`} aria-hidden="true">
        <Icon size={80} className={iconColorClass} />
      </div>

      <div className="flex items-center justify-between z-10">
        <div className="flex flex-col">
          <p className={`text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-widest`}>{title}</p>
        </div>
        <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 ${iconColorClass}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex flex-col items-start z-10 mt-2">
        <div className="flex items-center gap-2">
          <p className={`text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums leading-none font-display ${animate ? 'animate-pop' : ''}`}>
            {value.toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          {trend !== undefined ? (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold ${trendColorBg} ${trendColorText}`}>
              {trend >= 100 ? (
                <Flame size={12} className="text-orange-600 dark:text-orange-400" aria-hidden="true" />
              ) : isPositive ? (
                <ArrowUp size={12} aria-hidden="true" />
              ) : (
                <ArrowDown size={12} aria-hidden="true" />
              )}
              {Math.abs(trend)}%
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              New Items
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">
            {trendLabel || subValue}
          </span>
        </div>
      </div>
      
    </div>
  );
};

export default StatCard;
