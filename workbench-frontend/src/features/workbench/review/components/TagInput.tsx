import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, ChevronDown } from 'lucide-react';
import { listFilterTags, listTagDefinitions } from '@/services/tagApi';

type TagOption = {
  id: string;
  name: string;
  description?: string | null;
};

interface TagInputProps {
  onSelect: (payload: { tagDefinitionId: string } | { tagName: string }) => void;
  disabled?: boolean;
  /** Tag definition IDs already applied to this session (to exclude from list) */
  excludeTagIds?: string[];
  /** Whether the user can create new tags (TAG_CREATE permission). Defaults to true for backward compat. */
  canCreateTag?: boolean;
}

export function TagInput({ onSelect, disabled = false, excludeTagIds = [], canCreateTag = true }: TagInputProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch chat-category tags
  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      // Primary source for reviewer flows: review-scoped tags endpoint.
      const reviewTags = await listFilterTags();
      const reviewTagOptions: TagOption[] = reviewTags
        .filter((tag) => tag.category === 'chat')
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          description: null,
        }));
      setTags(reviewTagOptions);
    } catch {
      // Backward-compatible fallback for environments lacking /api/review/tags.
      try {
        const adminTags = await listTagDefinitions({ category: 'chat', active: true });
        setTags(
          adminTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            description: tag.description ?? null,
          }))
        );
        setLoadError(null);
      } catch {
        setTags([]);
        setLoadError(t('review.tags.loadError', 'Failed to load tags'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Filter tags based on query, excluding already-applied tags
  const excludeSet = useMemo(() => new Set(excludeTagIds), [excludeTagIds]);

  const filteredTags = useMemo(() => {
    const available = tags.filter((tag) => !excludeSet.has(tag.id));
    if (!query.trim()) return available;
    const lower = query.toLowerCase();
    return available.filter((tag) => tag.name.toLowerCase().includes(lower));
  }, [tags, query, excludeSet]);

  // Determine if we should show the "Create new tag" option
  const exactMatch = useMemo(() => {
    if (!query.trim()) return true; // no text → don't show create option
    const lower = query.trim().toLowerCase();
    return tags.some((tag) => tag.name.toLowerCase() === lower);
  }, [tags, query]);

  const showCreateOption = canCreateTag && query.trim().length > 0 && !exactMatch;

  // Total options count (for keyboard navigation)
  const optionCount = filteredTags.length + (showCreateOption ? 1 : 0);

  // Keep active index valid when available options change.
  useEffect(() => {
    setActiveIndex((prev) => {
      if (optionCount <= 0) return -1;
      return prev >= optionCount ? optionCount - 1 : prev;
    });
  }, [optionCount]);

  // ── Handlers ──

  const handleSelect = (payload: { tagDefinitionId: string } | { tagName: string }) => {
    onSelect(payload);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleInputFocus = () => {
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < optionCount - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : optionCount - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredTags.length) {
          handleSelect({ tagName: filteredTags[activeIndex].name });
        } else if (activeIndex === filteredTags.length && showCreateOption) {
          handleSelect({ tagName: query.trim() });
        } else if (showCreateOption) {
          // Enter with no selection but create option is available
          handleSelect({ tagName: query.trim() });
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const listboxId = 'tag-input-listbox';

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={t('review.tags.addTag')}
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-3 pr-8 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 ? `tag-option-${activeIndex}` : undefined
            }
            aria-label={t('review.tags.addTag')}
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setOpen(!open);
              inputRef.current?.focus();
            }}
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400"
            aria-hidden="true"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Dropdown list */}
      {open && optionCount > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {filteredTags.map((tag, index) => (
            <li
              key={tag.id}
              id={`tag-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              className={`cursor-pointer px-3 py-1.5 text-xs ${
                activeIndex === index
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => handleSelect({ tagName: tag.name })}
            >
              <span className="font-medium">{tag.name}</span>
              {tag.description && (
                <span className="ml-2 text-neutral-400">{tag.description}</span>
              )}
            </li>
          ))}

          {showCreateOption && (
            <li
              id={`tag-option-${filteredTags.length}`}
              role="option"
              aria-selected={activeIndex === filteredTags.length}
              className={`cursor-pointer border-t border-neutral-100 px-3 py-1.5 text-xs ${
                activeIndex === filteredTags.length
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
              onMouseEnter={() => setActiveIndex(filteredTags.length)}
              onClick={() => handleSelect({ tagName: query.trim() })}
            >
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                {t('review.tags.createNew')}: <span className="font-semibold">{query.trim()}</span>
              </span>
            </li>
          )}
        </ul>
      )}
      {loadError && (
        <p className="mt-1 text-[11px] text-red-600">{loadError}</p>
      )}
    </div>
  );
}
