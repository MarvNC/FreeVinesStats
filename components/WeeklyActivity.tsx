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

  const handleMouseEnter = (e: React.MouseEvent, date: string, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({ date, value, x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 p-5 sm:p-6 flex flex-col w-full overflow-visible relative">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Weekly Activity</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Local timezone · last 24 weeks</p>
        </div>
      </div>
      
      <div className="w-full overflow-x-auto pb-1 scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] sm:[mask-image:none]">
        <div className="flex flex-col gap-[3px] w-full">
          {/* Months header */}
          <div className="grid grid-cols-[28px_repeat(24,1fr)] gap-[3px] mb-1">
            <div />
            {weeks.map((weekStart, idx) => {
              const weekEnd    = weekStart.add(6, 'day');
              const startMonth = weekStart.month();
              const endMonth   = weekEnd.month();
              const isNewMonth = startMonth !== endMonth || weekStart.date() === 1;
              const label      = startMonth !== endMonth ? weekEnd.format('MMM') : weekStart.format('MMM');
              return (
                <div key={idx} className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold text-center">
                  {isNewMonth ? label : ''}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {daysOfWeek.map((dayName, dayIndex) => (
            <div key={dayName} className="grid grid-cols-[28px_repeat(24,1fr)] gap-[3px] items-center">
              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold text-right pr-1.5">{dayName}</div>
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
                    className={`aspect-square rounded-[3px] ${finalColor} transition-colors duration-150 cursor-crosshair hover:ring-1 hover:ring-primary/40 touch-manipulation`}
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

      <HeatLegend />

      {/* Floating Tooltip */}
      {hoveredCell && (
        <div 
          className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-2 bg-slate-900/95 dark:bg-white/95 backdrop-blur-sm text-white dark:text-slate-900 rounded-lg shadow-2xl text-xs font-bold whitespace-nowrap"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="opacity-60 text-[10px] mb-0.5">{hoveredCell.date}</div>
          <div>{hoveredCell.value.toLocaleString()} <span className="font-medium opacity-70">items</span></div>
          <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-slate-900/95 dark:bg-white/95 -translate-x-1/2 translate-y-1/2 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default WeeklyActivity;
