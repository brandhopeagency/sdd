import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar } from 'lucide-react';
import SurveyDownloadButton from './SurveyDownloadButton';

interface SurveyItem {
  instanceId: string;
  title: string;
  publicHeader: string | null;
  status: string;
  displayOrder: number;
  startDate: string;
  expirationDate: string;
  completedCount: number;
  showReview: boolean;
}

interface GroupSurveyListProps {
  surveys: SurveyItem[];
  onReorder: (instanceIds: string[]) => void;
  onDownload: (instanceId: string, format: 'json' | 'csv') => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-neutral-100 text-neutral-500',
  closed: 'bg-neutral-100 text-neutral-500',
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_STYLES[status.toLowerCase()] ?? 'bg-neutral-100 text-neutral-500';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${colors}`}>
      {status}
    </span>
  );
}

function SortableSurveyItem({
  survey,
  onDownload,
}: {
  survey: SurveyItem;
  onDownload: (instanceId: string, format: 'json' | 'csv') => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: survey.instanceId,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const startLabel = new Date(survey.startDate).toLocaleDateString();
  const endLabel = new Date(survey.expirationDate).toLocaleDateString();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="text-neutral-400 hover:text-neutral-600 cursor-grab shrink-0"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-800 truncate">{survey.title}</span>
          <StatusBadge status={survey.status} />
        </div>
        {survey.publicHeader && (
          <p className="text-xs text-neutral-500 truncate mt-0.5">{survey.publicHeader}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {startLabel} – {endLabel}
          </span>
          <span>
            {t('survey.groupSurveys.completed', { count: survey.completedCount })}
          </span>
        </div>
      </div>

      <SurveyDownloadButton instanceId={survey.instanceId} onDownload={onDownload} />
    </div>
  );
}

export default function GroupSurveyList({ surveys, onReorder, onDownload }: GroupSurveyListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = [...surveys].sort((a, b) => a.displayOrder - b.displayOrder);
  const ids = sorted.map((s) => s.instanceId);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      const reordered = arrayMove(ids, oldIndex, newIndex);
      onReorder(reordered);
    },
    [ids, onReorder],
  );

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {sorted.map((survey) => (
            <SortableSurveyItem key={survey.instanceId} survey={survey} onDownload={onDownload} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
