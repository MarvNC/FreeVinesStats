import React from 'react';

const HEAT_LEVELS = [0, 1, 2, 3, 4, 5] as const;

const HeatLegend: React.FC = () => (
  <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium select-none" aria-label="Color scale: less to more activity">
    <span>Less</span>
    {HEAT_LEVELS.map((i) => (
      <div
        key={i}
        className={`size-3 rounded-sm bg-heat-${i}`}
        aria-hidden="true"
      />
    ))}
    <span>More</span>
  </div>
);

export default HeatLegend;
