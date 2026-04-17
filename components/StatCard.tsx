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
    ? 'text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
    : isExtremeTrend
    ? 'text-orange-500 border-orange-500/30 bg-orange-500/10'
    : isPositive ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-500 border-rose-500/30 bg-rose-500/10';

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
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase font-mono">
          <Icon size={14} className={iconColorClass} />
          <span>{title}</span>
        </div>
        {trend !== undefined && (
          <span className={`flex items-center text-[10px] font-bold tabular-nums font-mono px-1.5 py-0.5 border ${trendColorText}`}>
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
      <div className="flex items-end gap-3 mt-1">
        <div className={`text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tighter leading-none font-mono drop-shadow-[0_0_12px_rgba(255,255,255,0.1)] dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] ${animate ? 'animate-pop text-primary' : ''} transition-colors duration-300`}>
          {value.toLocaleString()}
        </div>
      </div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono tracking-widest uppercase border-t border-slate-200 dark:border-slate-800 pt-2 mt-1">
        {subValue}
      </div>
    </div>
  );
};

export default StatCard;