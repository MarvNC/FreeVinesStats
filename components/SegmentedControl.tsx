import React from 'react';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
  keyboardHint?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'elevated' | 'flat';
  name: string; // unique name for radio group
}

const SegmentedControl = <T extends string | number>({
  options,
  value,
  onChange,
  variant = 'elevated',
  name,
}: SegmentedControlProps<T>) => {
  const containerClass = 'bg-transparent';

  const activeClass = 'text-stone-900 dark:text-stone-100 border-b-2 border-primary';

  const inactiveClass = 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/30';

  return (
    <div className={`${containerClass} flex items-center w-full sm:w-auto overflow-x-auto scrollbar-hide`} role="group" aria-label={name}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = option.disabled;
        
        return (
          <label 
            key={String(option.value)} 
            className={`flex-1 sm:flex-none relative ${isDisabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'}`}
          >
            <input 
              type="radio" 
              name={name} 
              className="peer sr-only" 
              checked={isSelected}
              onChange={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
            />
            <div className={`
              px-3 py-1.5 text-sm font-medium transition-all duration-200 text-center min-w-[3rem] whitespace-nowrap select-none flex items-center justify-center gap-1.5
              ${isSelected ? activeClass : inactiveClass}
            `}>
              {option.label}
              {option.keyboardHint && (
                <span className={`inline-flex items-center justify-center rounded-md text-[10px] px-1.5 py-0.5 font-medium tabular-nums opacity-60 bg-current/10`}>
                  {option.keyboardHint}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
