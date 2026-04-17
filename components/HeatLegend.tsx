import React from 'react';

const HEAT_LEVELS = [0, 1, 2, 3, 4, 5] as const;

const HeatLegend: React.FC = () => (
  <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold select-none uppercase font-mono tracking-widest" aria-label="Color scale: less to more activity">
    <span>LESS</span>
    {HEAT_LEVELS.map((i) => (
      <div
        key={i}
        className={`size-3 rounded-none bg-heat-${i} border border-white/5 dark:border-black/5`}
        aria-hidden="true"
      />
    ))}
    <span>MORE</span>
  </div>
);

export default HeatLegend;
