import { useCallback, useRef, useEffect } from 'react';
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
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';
import type { SurveyQuestionInput } from '@mentalhelpglobal/chat-types';
import QuestionEditor from './QuestionEditor';
import { GripVertical, Plus } from 'lucide-react';

interface Props {
  questions: SurveyQuestionInput[];
  onChange: (questions: SurveyQuestionInput[]) => void;
  disabled?: boolean;
}

let uidCounter = 0;
function nextUid() { return `quid-${++uidCounter}`; }

function toEditorQuestions(inputs: SurveyQuestionInput[]) {
  return inputs.map((q, i) => ({
    id: (q as any).id ?? `draft-${i}`,
    order: i + 1,
    text: q.text,
    type: q.type as SurveyQuestionType,
    options: q.options ?? null,
    visibilityConditions: q.visibilityConditions ?? null,
    visibilityConditionCombinator: q.visibilityConditionCombinator ?? null,
    optionConfigs: q.optionConfigs ?? null,
  }));
}

function SortableQuestionItem({
  question,
  index,
  allQuestions,
  onChange,
  onRemove,
  disabled,
  id,
}: {
  question: SurveyQuestionInput;
  index: number;
  allQuestions: SurveyQuestionInput[];
  onChange: (q: SurveyQuestionInput) => void;
  onRemove: () => void;
  disabled?: boolean;
  id: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      {!disabled && (
        <button {...attributes} {...listeners} aria-label="Drag to reorder" className="mt-4 text-gray-400 hover:text-gray-600 cursor-grab">
          <GripVertical className="w-5 h-5" />
        </button>
      )}
      <div className="flex-1">
        <QuestionEditor
          question={question}
          index={index}
          allQuestions={toEditorQuestions(allQuestions)}
          onChange={onChange}
          onRemove={onRemove}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function QuestionList({ questions, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const uidsRef = useRef<string[]>([]);

  useEffect(() => {
    while (uidsRef.current.length < questions.length) {
      uidsRef.current.push(nextUid());
    }
    if (uidsRef.current.length > questions.length) {
      uidsRef.current = uidsRef.current.slice(0, questions.length);
    }
  }, [questions.length]);

  while (uidsRef.current.length < questions.length) {
    uidsRef.current.push(nextUid());
  }

  const ids = uidsRef.current.slice(0, questions.length);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    uidsRef.current = arrayMove(uidsRef.current, oldIndex, newIndex);
    onChange(arrayMove(questions, oldIndex, newIndex));
  }, [ids, questions, onChange]);

  const addQuestion = useCallback(() => {
    uidsRef.current.push(nextUid());
    onChange([...questions, { type: SurveyQuestionType.FREE_TEXT, text: '', required: true }]);
  }, [questions, onChange]);

  const updateQuestion = useCallback((index: number, updated: SurveyQuestionInput) => {
    const copy = [...questions];
    copy[index] = updated;
    onChange(copy);
  }, [questions, onChange]);

  const removeQuestion = useCallback((index: number) => {
    uidsRef.current.splice(index, 1);
    onChange(questions.filter((_, i) => i !== index));
  }, [questions, onChange]);

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {questions.map((q, i) => (
            <SortableQuestionItem
              key={ids[i]}
              id={ids[i]}
              question={q}
              index={i}
              allQuestions={questions}
              onChange={(updated) => updateQuestion(i, updated)}
              onRemove={() => removeQuestion(i)}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!disabled && (
        <button
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 w-full justify-center"
        >
          <Plus className="w-4 h-4" /> {t('survey.question.add')}
        </button>
      )}
    </div>
  );
}
