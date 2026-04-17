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
    <div className="flex items-center gap-2 font-mono whitespace-nowrap group hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 -m-1 transition-colors">
      <Icon size={14} className={iconColorClass} />
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}:</span>
      <span className={`text-base font-extrabold text-slate-900 dark:text-white tabular-nums leading-none ${animate ? 'animate-pop' : ''}`}>
        {value.toLocaleString()}
      </span>
      {trend !== undefined && (
        <span className={`flex items-center text-[11px] font-bold tabular-nums ml-1 ${trendColorText}`}>
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
  );
};

export default StatCard;