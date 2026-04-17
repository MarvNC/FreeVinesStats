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
    ? 'text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-800'
    : isExtremeTrend
    ? 'text-orange-600 dark:text-orange-500 bg-orange-100 dark:bg-orange-500/10'
    : isPositive ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10' : 'text-rose-600 dark:text-rose-500 bg-rose-100 dark:bg-rose-500/10';

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
    <div className="flex flex-col gap-3 group relative z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm font-medium">
          <Icon size={14} className={iconColorClass} />
          <span>{title}</span>
        </div>
        {trend !== undefined && (
          <span className={`flex items-center text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${trendColorText}`}>
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
      </div>
      <div className="flex items-end gap-3 mt-2">
        <div className={`text-4xl sm:text-5xl font-bold text-stone-900 dark:text-white tabular-nums tracking-tight leading-none drop-shadow-sm ${animate ? 'animate-pop text-primary' : ''} transition-colors duration-300`}>
          {value.toLocaleString()}
        </div>
      </div>
      <div className="text-xs text-stone-500 dark:text-stone-400 font-medium pt-3 mt-1 border-t border-stone-100 dark:border-stone-800/60">
        {subValue}
      </div>
    </div>
  );
};

export default StatCard;