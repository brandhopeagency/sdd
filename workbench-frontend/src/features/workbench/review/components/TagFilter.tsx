import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, ChevronDown, X } from 'lucide-react';
import { listFilterTags, type FilterTag } from '@/services/tagApi';

interface TagFilterProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagFilter({ selectedTags, onChange }: TagFilterProps) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<FilterTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listFilterTags()
      .then((data) => {
        if (!cancelled) setTags(data);
      })
      .catch(() => {
        // Silently handle — empty tag list is acceptable
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onChange([...selectedTags, tagName]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  if (loading || tags.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        {t('review.tags.filter')}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm
          transition-colors duration-150
          focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300
          ${selectedTags.length > 0
            ? 'border-sky-300 text-sky-700'
            : 'border-neutral-300 text-neutral-700'
          }
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Tag size={14} className="shrink-0" aria-hidden="true" />
          {selectedTags.length > 0
            ? t('review.tags.filter') + ` (${selectedTags.length})`
            : t('review.tags.filter')
          }
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
          role="listbox"
          aria-multiselectable="true"
          aria-label={t('review.tags.filter')}
        >
          {/* Clear selection */}
          {selectedTags.length > 0 && (
            <div className="border-b border-neutral-100 px-3 py-1.5">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
              >
                <X size={12} aria-hidden="true" />
                {t('review.queue.filters.clearAll')}
              </button>
            </div>
          )}

          {/* Tag checkboxes */}
          <div className="max-h-56 overflow-y-auto">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag.name);
              return (
                <label
                  key={tag.id}
                  role="option"
                  aria-selected={isSelected}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTag(tag.name)}
                    className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-300"
                  />
                  <span className="flex-1 truncate text-neutral-700">{tag.name}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {tag.sessionCount}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
