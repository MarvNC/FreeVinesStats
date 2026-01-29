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
  const trendColorBg = isPositive ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-rose-100 dark:bg-rose-900';
  const trendColorText = isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300';
  const trendIcon = isPositive ? 'arrow_upward' : 'arrow_downward';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-40 relative overflow-hidden group transition-transform hover:-translate-y-1">
      <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity select-none pointer-events-none">
        <span className={`material-symbols-outlined text-8xl ${iconColorClass}`}>{icon}</span>
      </div>
      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-wider z-10">{title}</p>
      <div className="z-10">
        <p className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tighter">
          {value.toLocaleString()}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${trendColorBg} ${trendColorText}`}>
              <span className="material-symbols-outlined text-sm mr-0.5">{trendIcon}</span>
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{trendLabel || subValue}</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
