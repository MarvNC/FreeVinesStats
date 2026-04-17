import React, { useState, useMemo } from 'react';
import { getHeatColor } from '../utils/analytics';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import HeatLegend from './HeatLegend';

dayjs.extend(isoWeek);

interface WeeklyActivityProps {
  data: Record<string, number>;
  maxDaily: number;
}

const WeeklyActivity: React.FC<WeeklyActivityProps> = ({ data, maxDaily }) => {
  const [hoveredCell, setHoveredCell] = useState<{date: string, value: number, x: number, y: number} | null>(null);
  
  const { weeks, today } = useMemo(() => {
    const currentWeekStart = dayjs().startOf('isoWeek');
    const weeksToDisplay = 24;
    const w = [];
    for (let i = weeksToDisplay - 1; i >= 0; i--) {
      w.push(currentWeekStart.subtract(i, 'week'));
    }
    return { weeks: w, today: dayjs().endOf('day') };
  }, []);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleMouseEnter = (e: React.MouseEvent | React.FocusEvent<HTMLDivElement>, date: string, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({ date, value, x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  return (
    <div className="flex flex-col w-full overflow-visible relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 font-display flex items-center gap-2">
            Weekly Activity
          </h3>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mt-1">PST · Last 24 Weeks</p>
        </div>
      </div>
      
      <div className="w-full overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex flex-col gap-[2px] w-full">
          {/* Months header */}
          <div className="grid grid-cols-[24px_repeat(24,1fr)] gap-[2px] mb-1">
            <div />
            {weeks.map((weekStart, idx) => {
              const weekEnd    = weekStart.add(6, 'day');
              const startMonth = weekStart.month();
              const endMonth   = weekEnd.month();
              const isNewMonth = startMonth !== endMonth || weekStart.date() === 1;
              const label      = startMonth !== endMonth ? weekEnd.format('MMM') : weekStart.format('MMM');
              return (
                <div key={idx} className="text-[8px] text-stone-400 dark:text-stone-500 font-bold text-center tracking-tighter">
                  {isNewMonth ? label : ''}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {daysOfWeek.map((dayName, dayIndex) => (
            <div key={dayName} className="grid grid-cols-[24px_repeat(24,1fr)] gap-[2px] items-center">
              <div className="text-[8px] text-stone-400 dark:text-stone-500 font-bold text-right pr-1.5 tracking-tighter">{dayName}</div>
              {weeks.map((weekStart, weekIndex) => {
                const cellDate  = weekStart.add(dayIndex, 'day');
                const dateKey   = cellDate.format('YYYY-MM-DD');
                const value     = data[dateKey] || 0;
                const colorClass = getHeatColor(value, maxDaily);
                const isFuture  = cellDate.isAfter(today);
                const finalColor = isFuture ? 'opacity-0 pointer-events-none' : colorClass;

                return (
                  <div 
                    key={weekIndex} 
                    onMouseEnter={(e) => !isFuture && handleMouseEnter(e, dateKey, value)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onFocus={(e) => !isFuture && handleMouseEnter(e, dateKey, value)}
                    onBlur={() => setHoveredCell(null)}
                    tabIndex={isFuture ? -1 : 0}
                    className={`aspect-square rounded-none ${finalColor} cursor-crosshair hover:ring-1 hover:ring-primary/40 focus:ring-2 focus:ring-primary focus:outline-none touch-manipulation border border-white/5 dark:border-black/5`}
                    title={!isFuture ? `${dateKey}: ${value.toLocaleString()} items` : undefined}
                    aria-label={!isFuture ? `${dateKey}: ${value.toLocaleString()} items` : undefined}
                    role={!isFuture ? 'img' : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <HeatLegend />
      </div>

      {hoveredCell && (
        <div
          className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-2 bg-stone-900/95 dark:bg-stone-100/95 text-stone-100 dark:text-stone-900 shadow-xl text-xs font-bold whitespace-nowrap rounded-lg border border-stone-700 dark:border-stone-300"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="opacity-60 text-[10px] mb-0.5">{hoveredCell.date}</div>
          <div className="tabular-nums">{hoveredCell.value.toLocaleString()} <span className="font-bold opacity-60 text-[10px]">Items</span></div>
        </div>
      )}
    </div>
  );
};

export default WeeklyActivity;