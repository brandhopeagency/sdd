import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SCORE_LABELS } from '@mentalhelpglobal/chat-types';
import GradeTooltip from './GradeTooltip';

interface ScoreSelectorProps {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function ScoreSelector({ value, onChange, disabled = false }: ScoreSelectorProps) {
  const { t } = useTranslation();
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const activeScore = hoveredScore ?? value;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      let nextIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = Math.min(focusedIndex + 1, SCORES.length - 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = Math.max(focusedIndex - 1, 0);
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = SCORES.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onChange(SCORES[focusedIndex]);
          return;
        default:
          return;
      }

      setFocusedIndex(nextIndex);
      buttonsRef.current[nextIndex]?.focus();
    },
    [disabled, focusedIndex, onChange],
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-neutral-700">
        {t('review.scoreSelector.label')}
      </label>

      <div
        role="radiogroup"
        aria-label={t('review.scoreSelector.ariaLabel')}
        className="flex items-center gap-1.5 sm:gap-2"
        onKeyDown={handleKeyDown}
      >
        {SCORES.map((score, index) => {
          const { color } = SCORE_LABELS[score];
          const isSelected = value === score;
          const isHovered = hoveredScore === score;

          return (
            <button
              key={score}
              ref={(el) => { buttonsRef.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t('review.scoreSelector.buttonAriaLabel', {
                score,
                label: t(`review.score.labels.${score}`),
              })}
              tabIndex={
                isSelected
                  ? 0
                  : value === null && index === 0
                    ? 0
                    : -1
              }
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  onChange(score);
                  setFocusedIndex(index);
                }
              }}
              onMouseEnter={() => !disabled && setHoveredScore(score)}
              onMouseLeave={() => setHoveredScore(null)}
              onFocus={() => setFocusedIndex(index)}
              className={`
                relative flex h-10 w-10 items-center justify-center rounded-lg
                text-sm font-semibold transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-1
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                ${
                  isSelected
                    ? 'text-white shadow-md ring-0'
                    : isHovered
                      ? 'border-2 shadow-sm'
                      : 'border-2 border-neutral-300 text-neutral-600 hover:border-neutral-400'
                }
              `}
              style={{
                backgroundColor: isSelected ? color : undefined,
                borderColor: isHovered && !isSelected ? color : undefined,
                color: isHovered && !isSelected ? color : undefined,
                // Use the score color as the focus ring color
                ...(isSelected ? { boxShadow: `0 0 0 2px ${color}33` } : {}),
                ...(focusedIndex === index ? { outlineColor: color } : {}),
              }}
            >
              {score}
              <GradeTooltip scoreLevel={score} />
            </button>
          );
        })}
      </div>

      {/* Label display */}
      <div
        className="h-5 text-sm font-medium transition-opacity duration-150"
        style={{
          color: activeScore ? SCORE_LABELS[activeScore].color : undefined,
          opacity: activeScore ? 1 : 0,
        }}
        aria-live="polite"
      >
        {activeScore
          ? t(`review.score.labels.${activeScore}`)
          : '\u00A0'}
      </div>
    </div>
  );
}
