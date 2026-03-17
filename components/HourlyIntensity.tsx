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

  const handleMouseEnter = (e: React.MouseEvent, day: string, hour: number, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({ day, hour, value, x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 p-5 sm:p-6 flex flex-col w-full overflow-visible relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Hourly Intensity</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Local timezone · {mode === 'median' ? 'median' : 'mean'} drops per hour
          </p>
        </div>
        <SegmentedControl 
          options={[
            { value: 'median', label: 'Median' },
            { value: 'mean',   label: 'Mean'   }
          ]}
          value={mode}
          onChange={(val) => setMode(val as 'median' | 'mean')}
          name="intensityMode"
          variant="elevated"
        />
      </div>
      
      <div className="w-full overflow-x-auto pb-1 scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] sm:[mask-image:none]">
        <div className="flex flex-col gap-[3px] w-full">
          {/* Hours header */}
          <div className="grid grid-cols-[28px_repeat(24,1fr)] gap-[3px] mb-1">
            <div />
            {hours.map((h) => (
              <div key={h} className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold text-center">
                {h % 4 === 0 || h === 23 ? String(h).padStart(2, '0') : ''}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {daysOfWeek.map((dayName, dayIndex) => (
            <div key={dayName} className="grid grid-cols-[28px_repeat(24,1fr)] gap-[3px] items-center">
              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold text-right pr-1.5">{dayName}</div>
              {hours.map((hour) => {
                const value      = currentData[dayIndex]?.[hour] ?? 0;
                const colorClass = getHeatColor(value, currentMax);

                return (
                  <div 
                    key={hour} 
                    onMouseEnter={(e) => handleMouseEnter(e, dayName, hour, value)}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`aspect-square rounded-[3px] ${colorClass} cursor-crosshair hover:ring-1 hover:ring-primary/40 touch-manipulation`}
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

      <HeatLegend />

      {/* Floating Tooltip */}
      {hoveredCell && (
        <div 
          className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-2 bg-slate-900/95 dark:bg-white/95 backdrop-blur-sm text-white dark:text-slate-900 rounded-lg shadow-2xl text-xs font-bold whitespace-nowrap"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <div className="opacity-60 text-[10px] mb-0.5">{hoveredCell.day} · {String(hoveredCell.hour).padStart(2, '0')}:00</div>
          <div>{hoveredCell.value.toLocaleString()} <span className="font-medium opacity-70">{mode} drops</span></div>
          <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-slate-900/95 dark:bg-white/95 -translate-x-1/2 translate-y-1/2 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default HourlyIntensity;
