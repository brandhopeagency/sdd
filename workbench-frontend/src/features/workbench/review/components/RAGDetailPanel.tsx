import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { RAGCallDetail } from '@mentalhelpglobal/chat-types';

interface Props {
  ragDetail: RAGCallDetail;
}

export default function RAGDetailPanel({ ragDetail }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!ragDetail.retrievedDocuments?.length && !ragDetail.retrievalQuery) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors rounded-lg"
      >
        <BookOpen className="w-3.5 h-3.5" />
        RAG Details
        <span className="text-purple-500">({ragDetail.retrievedDocuments?.length ?? 0} docs)</span>
        {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {ragDetail.retrievalQuery && (
            <div className="flex items-start gap-2 text-xs">
              <Search className="w-3 h-3 mt-0.5 text-purple-500 flex-shrink-0" />
              <div>
                <span className="font-medium text-purple-700 dark:text-purple-300">Query:</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{ragDetail.retrievalQuery}</span>
              </div>
            </div>
          )}

          {ragDetail.retrievedDocuments?.map((doc, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                  {doc.title}
                </span>
                <span className="text-purple-600 dark:text-purple-400 ml-2 flex-shrink-0">
                  {(doc.relevanceScore * 100).toFixed(0)}%
                </span>
              </div>
              {doc.contentSnippet && (
                <p className="text-gray-500 dark:text-gray-400 line-clamp-3">
                  {doc.contentSnippet}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
