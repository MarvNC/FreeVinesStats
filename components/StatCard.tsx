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
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue,
  trend, 
  icon: Icon, 
  iconColorClass
}) => {
  const isPositive = trend !== undefined && trend >= 0;
  const isExtremeTrend = trend !== undefined && trend >= 100;
  const isLowData = value <= 3 && trend !== undefined && trend <= -80;
  
  const trendColorText = isLowData
    ? 'text-slate-400 dark:text-slate-500'
    : isExtremeTrend
    ? 'text-orange-600 dark:text-orange-400'
    : isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

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
    <div className="flex flex-col gap-1 group">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium tracking-wide uppercase">
        <Icon size={14} className={iconColorClass} />
        <span>{title}</span>
      </div>
      <div className={`text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight leading-none ${animate ? 'animate-pop' : ''}`}>
        {value.toLocaleString()}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={`flex items-center text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 ${trendColorText}`}>
            {trend >= 100 ? (
              <Flame size={12} className="mr-0.5" />
            ) : isPositive ? (
              <ArrowUp size={12} className="mr-0.5" />
            ) : (
              <ArrowDown size={12} className="mr-0.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          {subValue}
        </span>
      </div>
    </div>
  );
};

export default StatCard;