import React, { useState } from 'react';
import { getHeatColor } from '../utils/analytics';
import SegmentedControl from './SegmentedControl';
import HeatLegend from './HeatLegend';

interface HourlyIntensityProps {
  medianData: number[][]; // 7×24
  meanData:   number[][]; // 7×24
  maxMedian:  number;
  maxMean:    number;
}

const HourlyIntensity: React.FC<HourlyIntensityProps> = ({ 
  medianData, 
  meanData, 
  maxMedian, 
  maxMean 
}) => {
  const [hoveredCell, setHoveredCell] = useState<{day: string, hour: number, value: number, x: number, y: number} | null>(null);
  const [mode, setMode] = useState<'median' | 'mean'>('median');
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const currentData = mode === 'median' ? medianData : meanData;
  const currentMax  = mode === 'median' ? maxMedian  : maxMean;

  const handleMouseEnter = (e: React.MouseEvent | React.FocusEvent<HTMLDivElement>, day: string, hour: number, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({ day, hour, value, x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  return (
    <div className="flex flex-col w-full overflow-visible relative">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-3">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 font-display flex items-center gap-2">
            Hourly Intensity
          </h3>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mt-1">
            PST · {mode === 'median' ? 'Median' : 'Mean'} drops/hr
          </p>
        </div>
        <div className="self-end xl:self-auto">
          <SegmentedControl 
            options={[
              { value: 'median', label: 'Median' },
              { value: 'mean',   label: 'Mean'   }
            ]}
            value={mode}
            onChange={(val) => setMode(val as 'median' | 'mean')}
            name="intensityMode"
            variant="flat"
          />
        </div>
      </div>
      
      <div className="w-full overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex flex-col gap-[2px] w-full">
          {/* Hours header */}
          <div className="grid grid-cols-[24px_repeat(24,1fr)] gap-[2px] mb-1">
            <div />
            {hours.map((h) => (
              <div key={h} className="text-[8px] text-stone-400 dark:text-stone-500 font-bold text-center">
                {h % 4 === 0 || h === 23 ? String(h).padStart(2, '0') : ''}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {daysOfWeek.map((dayName, dayIndex) => (
            <div key={dayName} className="grid grid-cols-[24px_repeat(24,1fr)] gap-[2px] items-center">
              <div className="text-[8px] text-stone-400 dark:text-stone-500 font-bold text-right pr-1.5 tracking-tighter">{dayName}</div>
              {hours.map((hour) => {
                const value      = currentData[dayIndex]?.[hour] ?? 0;
                const colorClass = getHeatColor(value, currentMax);

                return (
                  <div 
                    key={hour} 
                    onMouseEnter={(e) => handleMouseEnter(e, dayName, hour, value)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onFocus={(e) => handleMouseEnter(e, dayName, hour, value)}
                    onBlur={() => setHoveredCell(null)}
                    tabIndex={0}
                    className={`aspect-square rounded-sm ${colorClass} cursor-crosshair hover:ring-1 hover:ring-primary/40 focus:ring-2 focus:ring-primary focus:outline-none touch-manipulation border border-white/5 dark:border-black/5`}
                    title={`${dayName} ${String(hour).padStart(2, '0')}:00 — ${value.toLocaleString()} ${mode} drops`}
                    aria-label={`${dayName} ${String(hour).padStart(2, '0')}:00 — ${value.toLocaleString()} ${mode} drops`}
                    role="img"
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
          className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-2 bg-stone-800/95 dark:bg-stone-200/95 text-stone-100 dark:text-stone-900 shadow-xl text-xs font-bold whitespace-nowrap rounded-lg border border-stone-700 dark:border-stone-300"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="opacity-60 text-[10px] mb-0.5">{hoveredCell.day} · {String(hoveredCell.hour).padStart(2, '0')}:00</div>
          <div className="tabular-nums">{hoveredCell.value.toLocaleString()} <span className="font-bold opacity-60 text-[10px]">{mode} drops</span></div>
        </div>
      )}
    </div>
  );
};

export default HourlyIntensity;
