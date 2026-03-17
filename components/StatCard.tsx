import React from 'react';

interface StatCardProps {
  title: string;
  value: number;
  subValue: string;
  trend?: number; // percentage
  trendLabel?: string;
  icon: string;
  iconColorClass: string;
  trendReverse?: boolean; // if true, positive is bad (not used here but good for future)
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  trendLabel, 
  icon, 
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
  const trendIcon = isPositive ? 'arrow_upward' : 'arrow_downward';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Decorative background icon */}
      <div className="absolute right-0 top-0 p-3 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity select-none pointer-events-none" aria-hidden="true">
        <span className={`material-symbols-outlined text-7xl ${iconColorClass}`}>{icon}</span>
      </div>

      {/* Title row */}
      <div className="flex items-center justify-between z-10">
        <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-widest">{title}</p>
      </div>

      {/* Value + trend */}
      <div className="z-10">
        <p className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
          {value.toLocaleString()}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold ${trendColorBg} ${trendColorText}`}>
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">{trendIcon}</span>
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">{trendLabel || subValue}</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
