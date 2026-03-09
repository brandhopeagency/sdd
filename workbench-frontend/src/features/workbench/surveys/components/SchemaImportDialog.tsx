import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileWarning } from 'lucide-react';
import { importSchemaFromFile } from '../utils/schemaImporter';
import type { ImportValidationError } from '../utils/schemaImporter';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SchemaImportDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<ImportValidationError[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setErrors([]);
    setImporting(true);

    const result = await importSchemaFromFile(file);

    if (result.success && result.schema) {
      onClose();
      navigate(`/workbench/surveys/schemas/${result.schema.id}/edit`);
    } else {
      setErrors(result.errors ?? []);
    }
    setImporting(false);
  }, [onClose, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('survey.import.title', { defaultValue: 'Import Survey Schema' })}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-600 mb-2">
            {t('survey.import.dragDrop', { defaultValue: 'Drag and drop a JSON file here, or' })}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 disabled:opacity-50"
          >
            {importing
              ? t('survey.import.importing', { defaultValue: 'Importing...' })
              : t('survey.import.browse', { defaultValue: 'Browse files' })}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileInput}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-2">
            {t('survey.import.hint', { defaultValue: 'JSON files up to 5 MB' })}
          </p>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileWarning className="w-4 h-4 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                {t('survey.import.validationFailed', { defaultValue: 'Validation failed' })}
              </p>
            </div>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li key={i} className="text-xs text-red-700">
                  <span className="font-mono text-red-500">{err.field}</span>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
