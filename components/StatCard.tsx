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
  const trendColorBg = isLowData
    ? 'bg-slate-100 dark:bg-slate-700'
    : isPositive ? 'bg-emerald-100 dark:bg-emerald-900/60' : 'bg-rose-100 dark:bg-rose-900/60';
  const trendColorText = isLowData
    ? 'text-slate-400 dark:text-slate-500'
    : isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-700/80 flex flex-row sm:flex-col items-center sm:items-start justify-between h-auto sm:h-36 relative overflow-hidden group hover:shadow-[0_0_20px_-5px_rgba(43,140,238,0.3)] dark:hover:shadow-[0_0_20px_-5px_rgba(43,140,238,0.2)] hover:-translate-y-0.5 transition-all duration-200 gap-3 sm:gap-0">
      
      {/* Decorative background icon - Desktop only */}
      <div className="absolute right-0 top-0 p-3 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity select-none pointer-events-none hidden sm:block" aria-hidden="true">
        <Icon size={72} className={iconColorClass} />
      </div>

      {/* Left side (Mobile) / Top side (Desktop) */}
      <div className="flex items-center sm:items-start gap-3 sm:gap-0 z-10 flex-1 sm:flex-none">
        <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 sm:hidden ${iconColorClass}`}>
          <Icon size={20} />
        </div>
        <div className="flex flex-col">
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-widest font-display">{title}</p>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium mt-0.5 sm:hidden">
            {subValue}
          </p>
        </div>
      </div>

      {/* Right side (Mobile) / Bottom side (Desktop) */}
      <div className="flex flex-col items-end sm:items-start z-10">
        <div className="flex items-center gap-2">
          <p key={value} className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight tabular-nums leading-none animate-pop">
            {value.toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-1.5">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold ${trendColorBg} ${trendColorText}`}>
              {trend >= 100 ? (
                <Flame size={10} className="sm:w-[11px] sm:h-[11px] text-orange-500" aria-hidden="true" />
              ) : isPositive ? (
                <ArrowUp size={10} className="sm:w-[11px] sm:h-[11px]" aria-hidden="true" />
              ) : (
                <ArrowDown size={10} className="sm:w-[11px] sm:h-[11px]" aria-hidden="true" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs font-medium hidden sm:inline-block">
            {trendLabel || subValue}
          </span>
        </div>
      </div>
      
    </div>
  );
};

export default StatCard;
