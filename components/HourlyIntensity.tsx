import React, { useState } from 'react';
import { getHeatColor } from '../utils/analytics';
import SegmentedControl from './SegmentedControl';

interface HourlyIntensityProps {
  medianData: number[][]; // 7x24
  meanData: number[][];   // 7x24
  maxMedian: number;
  maxMean: number;
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

  // Derive current data based on mode
  const currentData = mode === 'median' ? medianData : meanData;
  const currentMax = mode === 'median' ? maxMedian : maxMean;

  const handleMouseEnter = (e: React.MouseEvent, day: string, hour: number, value: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({
      day,
      hour,
      value,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 flex flex-col w-full overflow-visible relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Hourly Intensity</h3>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              ({mode === 'median' ? 'Median' : 'Mean'})
            </span>
        </div>
        
        {/* Toggle */}
        <SegmentedControl 
          options={[
            { value: 'median', label: 'Median' },
            { value: 'mean', label: 'Mean' }
          ]}
          value={mode}
          onChange={(val) => setMode(val as 'median' | 'mean')}
          name="intensityMode"
          variant="elevated"
        />
      </div>
      
      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
        <div className="min-w-[600px] flex flex-col gap-1 w-full">
            {/* Hours Header */}
            <div className="grid grid-cols-[30px_repeat(24,1fr)] gap-[3px] mb-1">
                <div className="text-[10px] text-slate-400 font-bold text-right pr-2"></div>
                {hours.map((h) => (
                    <div key={h} className="text-[9px] text-slate-400 font-bold text-center">
                        {h % 4 === 0 || h === 23 ? String(h).padStart(2, '0') : ''}
                    </div>
                ))}
            </div>

            {/* Rows for days */}
            {daysOfWeek.map((dayName, dayIndex) => (
                <div key={dayName} className="grid grid-cols-[30px_repeat(24,1fr)] gap-[3px] items-center">
                    <div className="text-[10px] text-slate-500 font-bold text-right pr-2">{dayName}</div>
                    {hours.map((hour) => {
                        const value = currentData[dayIndex]?.[hour] ?? 0;
                        const colorClass = getHeatColor(value, currentMax);

                        return (
                            <div 
                                key={hour} 
                                onMouseEnter={(e) => handleMouseEnter(e, dayName, hour, value)}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`aspect-square rounded-[4px] ${colorClass} transition-colors duration-200 cursor-crosshair hover:opacity-80`}
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
          <div className="opacity-70 text-[10px] uppercase mb-0.5 tracking-tight">{hoveredCell.day} @ {String(hoveredCell.hour).padStart(2, '0')}:00</div>
          <div>{hoveredCell.value.toLocaleString()} <span className="font-medium opacity-80">{mode} drops</span></div>
          <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-inherit transform -translate-x-1/2 translate-y-1/2 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default HourlyIntensity;