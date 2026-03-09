import { useMemo } from 'react';
import type { RatingScaleConfig } from '@mentalhelpglobal/chat-types';

interface Props {
  config: RatingScaleConfig;
  value: string;
  onChange: (value: string) => void;
}

export default function RatingScaleInput({ config, value, onChange }: Props) {
  const values = useMemo(() => {
    if (config.step <= 0 || config.endValue < config.startValue) return [];
    const result: number[] = [];
    const maxSegments = 1000;
    for (let v = config.startValue; v <= config.endValue && result.length < maxSegments; v += config.step) {
      result.push(Math.round(v * 1000) / 1000);
    }
    return result;
  }, [config]);

  const useSlider = values.length > 20;
  const selectedNum = value !== '' ? Number(value) : null;

  if (useSlider) {
    return (
      <div className="space-y-2">
        <input
          type="range"
          min={config.startValue}
          max={config.endValue}
          step={config.step}
          value={value || config.startValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{config.startValue}</span>
          {value && <span className="font-semibold text-indigo-600 text-sm">{value}</span>}
          <span>{config.endValue}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {values.map((v) => {
        const isSelected = selectedNum === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(String(v))}
            className={`min-w-[2.5rem] h-10 px-2 rounded-lg text-sm font-medium border-2 transition-colors
              ${isSelected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
