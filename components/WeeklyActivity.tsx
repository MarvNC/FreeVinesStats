import React, { useState, useMemo } from 'react';
import { getHeatColor } from '../utils/analytics';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface WeeklyActivityProps {
  data: Record<string, number>;
  maxDaily: number;
}

const WeeklyActivity: React.FC<WeeklyActivityProps> = ({ data, maxDaily }) => {
  const [hoveredCell, setHoveredCell] = useState<{date: string, value: number, x: number, y: number} | null>(null);
  
  const { weeks, today } = useMemo(() => {
    // Current Monday
    const currentWeekStart = dayjs().startOf('isoWeek');
    const weeksToDisplay = 24;
    const w = [];
    
    // Generate last 24 weeks
    for (let i = weeksToDisplay - 1; i >= 0; i--) {
        w.push(currentWeekStart.subtract(i, 'week'));
    }
    return { weeks: w, today: dayjs().endOf('day') };
  }, []);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleMouseEnter = (e: React.MouseEvent, date: string, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({
      date,
      value,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 flex flex-col w-full overflow-visible relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Activity (Local)</h3>
      </div>
      
      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex flex-col gap-1 w-full">
            {/* Months Header */}
            <div className="grid grid-cols-[30px_repeat(24,1fr)] gap-[3px] mb-1">
                <div className="text-[10px] text-slate-400 font-bold text-right pr-2"></div>
                {weeks.map((weekStart, idx) => {
                    const weekEnd = weekStart.add(6, 'day');
                    const startMonth = weekStart.month(); // 0-11
                    const endMonth = weekEnd.month();
                    
                    // Show label if new month starts in this week or if start month != end month
                    const isNewMonth = startMonth !== endMonth || weekStart.date() === 1;
                    const monthLabel = (startMonth !== endMonth) 
                        ? weekEnd.format('MMM')
                        : weekStart.format('MMM');

                    return (
                        <div key={idx} className="text-[9px] text-slate-400 font-bold text-center">
                            {isNewMonth ? monthLabel : ''}
                        </div>
                    );
                })}
            </div>

            {/* Rows for days */}
            {daysOfWeek.map((dayName, dayIndex) => (
                <div key={dayName} className="grid grid-cols-[30px_repeat(24,1fr)] gap-[3px] items-center">
                    <div className="text-[10px] text-slate-500 font-bold text-right pr-2">{dayName}</div>
                    {weeks.map((weekStart, weekIndex) => {
                        const cellDate = weekStart.add(dayIndex, 'day');
                        const dateKey = cellDate.format('YYYY-MM-DD');
                        const value = data[dateKey] || 0;
                        const colorClass = getHeatColor(value, maxDaily);
                        const isFuture = cellDate.isAfter(today);
                        const finalColor = isFuture ? 'opacity-0 pointer-events-none' : colorClass;

                        return (
                            <div 
                                key={weekIndex} 
                                onMouseEnter={(e) => !isFuture && handleMouseEnter(e, dateKey, value)}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`aspect-square rounded-[4px] ${finalColor} transition-colors duration-200 cursor-crosshair hover:opacity-80`}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
      </div>

      {/* Floating Tooltip */}
      {hoveredCell && (
        <div 
          className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg shadow-2xl text-xs font-bold whitespace-nowrap"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="opacity-70 text-[10px] uppercase mb-0.5 tracking-tight">{hoveredCell.date}</div>
          <div>{hoveredCell.value.toLocaleString()} <span className="font-medium opacity-80">items</span></div>
          <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-inherit transform -translate-x-1/2 translate-y-1/2 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default WeeklyActivity;