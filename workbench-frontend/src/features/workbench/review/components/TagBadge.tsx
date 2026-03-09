import { X } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  category?: 'user' | 'chat';
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ name, category, onRemove, className = '' }: TagBadgeProps) {

  // Color coding: blue for user tags, green for chat tags
  const categoryStyles = {
    user: 'bg-blue-100 text-blue-800 border-blue-200',
    chat: 'bg-green-100 text-green-800 border-green-200',
  };

  const baseStyles = categoryStyles[category || 'chat'];
  const badgeAriaLabel = category
    ? `${name} (${category} tag)`
    : `${name} tag`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${baseStyles} ${className}`}
      aria-label={badgeAriaLabel}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current"
          aria-label={`Remove ${name} tag`}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
