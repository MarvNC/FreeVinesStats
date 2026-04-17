import React from 'react';

interface StatCardProps {
  title: string;
  value: number;
  subValue: string;
  trend?: number;
  numberColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue,
  trend,
  numberColor = '#c9a96e'
}) => {
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
    <div className="flex flex-col">
      <span className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-1">
        {title}
      </span>
      <span 
        className={`text-4xl sm:text-5xl font-bold tabular-nums tracking-tight leading-none ${animate ? 'animate-pop' : ''} transition-colors duration-300`}
        style={{ color: numberColor }}
      >
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-2">
        {subValue}{trend !== undefined && (
          <span className="ml-1">
            {trend >= 0 ? '+' : ''}{trend}% vs typical
          </span>
        )}
      </span>
    </div>
  );
};

export default StatCard;
