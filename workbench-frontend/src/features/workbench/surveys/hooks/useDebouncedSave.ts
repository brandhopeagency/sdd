import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurveyQuestionInput, SurveySchema } from '@mentalhelpglobal/chat-types';
import { surveySchemaApi } from '@/services/surveyApi';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseDebouncedSaveOptions {
  schemaId: string | undefined;
  isReadOnly: boolean;
  title: string;
  description: string;
  questions: SurveyQuestionInput[];
  loadedSchema: SurveySchema | null;
}

interface UseDebouncedSaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  conflict: boolean;
  retrySave: () => void;
  dismissConflict: () => void;
  hasUnsavedChanges: boolean;
}

const DEBOUNCE_MS = 2000;

export function useDebouncedSave({
  schemaId,
  isReadOnly,
  title,
  description,
  questions,
  loadedSchema,
}: UseDebouncedSaveOptions): UseDebouncedSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const lastSavedUpdatedAt = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => {
    if (loadedSchema?.updatedAt) {
      lastSavedUpdatedAt.current = loadedSchema.updatedAt;
    }
  }, [loadedSchema]);

  const doSave = useCallback(async () => {
    if (!schemaId || isReadOnly || savingRef.current) return;

    savingRef.current = true;
    setSaveStatus('saving');

    const result = await surveySchemaApi.update(schemaId, {
      title,
      description: description || undefined,
      questions,
    });

    savingRef.current = false;

    if (result.success && result.data) {
      lastSavedUpdatedAt.current = result.data.updatedAt;
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
    } else {
      setSaveStatus('error');
    }
  }, [schemaId, isReadOnly, title, description, questions]);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (!schemaId || isReadOnly) return;

    setHasUnsavedChanges(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, description, questions, schemaId, isReadOnly, doSave]);

  useEffect(() => {
    if (!schemaId || isReadOnly) return;
    const interval = setInterval(async () => {
      if (savingRef.current) return;
      const result = await surveySchemaApi.get(schemaId);
      if (result.success && result.data && lastSavedUpdatedAt.current) {
        if (result.data.updatedAt !== lastSavedUpdatedAt.current) {
          setConflict(true);
          lastSavedUpdatedAt.current = result.data.updatedAt;
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [schemaId, isReadOnly]);

  const retrySave = useCallback(() => {
    doSave();
  }, [doSave]);

  const dismissConflict = useCallback(() => {
    setConflict(false);
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    conflict,
    retrySave,
    dismissConflict,
    hasUnsavedChanges,
  };
}
