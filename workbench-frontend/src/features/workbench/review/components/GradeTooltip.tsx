import { useState, useEffect, useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import type { GradeDescription } from '@mentalhelpglobal/chat-types';
import * as reviewApi from '@/services/reviewApi';

interface Props {
  scoreLevel: number;
}

let cachedDescriptions: GradeDescription[] | null = null;

export default function GradeTooltip({ scoreLevel }: Props) {
  const [visible, setVisible] = useState(false);
  const [descriptions, setDescriptions] = useState<GradeDescription[]>(cachedDescriptions ?? []);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cachedDescriptions) {
      reviewApi.getGradeDescriptions().then((data) => {
        cachedDescriptions = data;
        setDescriptions(data);
      }).catch(() => {});
    }
  }, []);

  const description = descriptions.find((d) => d.scoreLevel === scoreLevel);
  if (!description) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none"
        aria-label={`Grade ${scoreLevel} description`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg shadow-lg bg-gray-900 text-white text-xs leading-relaxed pointer-events-none"
        >
          <div className="font-medium mb-1">Score {scoreLevel}</div>
          {description.description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </span>
  );
}
