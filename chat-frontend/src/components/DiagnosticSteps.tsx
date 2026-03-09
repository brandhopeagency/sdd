/**
 * Diagnostic Steps Component
 * 
 * Displays DataStore Execution Sequence steps in a user-friendly format
 * for non-technical users with annotated sequential steps.
 */

import { CheckCircle, Clock, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { DiagnosticInfo } from '../types/conversation';

interface DiagnosticStepsProps {
  diagnosticInfo: DiagnosticInfo;
}

/**
 * Extract steps from diagnostic info structure
 */
function extractSteps(diagnosticInfo: DiagnosticInfo) {
  const dataStoreSeq = diagnosticInfo.fields?.['DataStore Execution Sequence']?.structValue?.fields?.['']?.structValue?.fields;
  
  if (!dataStoreSeq?.steps?.listValue?.values) {
    return [];
  }

  return dataStoreSeq.steps.listValue.values.map((step: any) => {
    const stepFields = step.structValue?.fields || {};
    const name = stepFields.name?.stringValue || '';
    const interval = stepFields.interval?.structValue?.fields;
    const status = stepFields.status?.structValue?.fields?.code?.stringValue || 'UNKNOWN';
    const responses = stepFields.responses?.listValue?.values || [];
    const info = stepFields.info?.stringValue;

    const startTime = interval?.start_time?.numberValue;
    const completeTime = interval?.complete_time?.numberValue;
    const duration = startTime && completeTime ? completeTime - startTime : null;

    return {
      name,
      duration,
      status,
      responses,
      info
    };
  });
}

/**
 * Extract execution result from diagnostic info
 */
function extractExecutionResult(diagnosticInfo: DiagnosticInfo) {
  const dataStoreSeq = diagnosticInfo.fields?.['DataStore Execution Sequence']?.structValue?.fields?.['']?.structValue?.fields;
  const result = dataStoreSeq?.executionResult?.structValue?.fields || {};
  
  return {
    language: result.language?.stringValue,
    responseType: result.response_type?.stringValue,
    responseReason: result.response_reason?.stringValue,
    latency: result.latency?.numberValue,
    faqCitation: result.faq_citation?.boolValue,
    unstructuredCitation: result.unstructured_citation?.boolValue,
    websiteCitation: result.website_citation?.boolValue,
    ucsFallback: result.ucs_fallback?.boolValue,
    bannedPhrase: result.banned_phrase?.stringValue,
    bannedPhraseCheckType: result.banned_phrase_check_type?.stringValue
  };
}

/**
 * Get Ukrainian translation for step name
 */
function getStepNameUk(name: string): string {
  const translations: Record<string, string> = {
    'Query rewrite': 'Переписування запиту',
    'Call Search with original query [connector]': 'Пошук у базі знань',
    'Convert UCS results for original query': 'Конвертація результатів',
    'Set summarization structured search prompt': 'Налаштування промпту',
    'ReAct turn': 'Генерація відповіді',
    'Parse ReAct Answer': 'Обробка відповіді'
  };
  return translations[name] || name;
}

/**
 * Get Ukrainian translation for response type
 */
function getResponseTypeUk(type: string): string {
  const translations: Record<string, string> = {
    'NO_RESULT': 'Поведінкова відповідь',
    'RESULT': 'Відповідь з результатами',
    'PARTIAL': 'Часткова відповідь'
  };
  return translations[type] || type;
}

/**
 * Get Ukrainian translation for response reason
 */
function getResponseReasonUk(reason: string): string {
  const translations: Record<string, string> = {
    'BEHAVIORAL': 'Поведінкова',
    'SEARCH_RESULT': 'Результат пошуку',
    'FAQ': 'Часті питання'
  };
  return translations[reason] || reason;
}

/**
 * Get language name in Ukrainian
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'uk': 'українська',
    'en': 'англійська',
    'ru': 'російська'
  };
  return languages[code] || code;
}

/**
 * Render step details based on step type
 */
function renderStepDetails(step: any, stepName: string) {
  const details: JSX.Element[] = [];

  // Query rewrite - show rewritten query
  if (stepName === 'Query rewrite' && step.responses?.length > 0) {
    const responseText = step.responses[0]?.structValue?.fields?.text?.stringValue || '';
    if (responseText) {
      // Extract the rewritten query from response
      const lines = responseText.split('\n');
      const searchLine = lines.find((line: string) => line.startsWith('Search:'));
      if (searchLine) {
        details.push(
          <div key="rewritten-query" className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Переписаний запит:</div>
            <div className="text-xs text-blue-900 dark:text-blue-100">{searchLine.replace('Search: ', '')}</div>
          </div>
        );
      }
    }
  }

  // Call Search - show all found documents
  if (stepName.includes('Call Search') && step.responses?.length > 0) {
    const searchResults = step.responses
      .map((r: any) => {
        const fields = r.structValue?.fields || {};
        const text = fields.text?.stringValue || '';
        if (text.includes('Ucs connector search result')) {
          // Extract document name from text
          const match = text.match(/'([^']+)'/);
          const docName = match ? match[1] : '';
          return {
            name: docName,
            url: fields.url?.stringValue,
            document: fields.document?.stringValue,
            debugId: fields.debugId?.stringValue,
            text: text
          };
        }
        return null;
      })
      .filter(Boolean);

    if (searchResults.length > 0) {
      details.push(
        <div key="search-results" className="mt-2 space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Знайдено документів: {searchResults.length}
          </div>
          <div className="space-y-1.5">
            {searchResults.map((result: any, idx: number) => (
              <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {result.name || `Документ ${idx + 1}`}
                </div>
                {result.url && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                    <span className="font-medium">URL:</span>{' '}
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {result.url}
                    </a>
                  </div>
                )}
                {result.document && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">
                    <span className="font-medium">Document ID:</span> {result.document}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Convert UCS results - show extractive answers and document contexts
  if (stepName.includes('Convert UCS results') && step.responses?.length > 0) {
    const convertedResults = step.responses.map((r: any) => {
      const fields = r.structValue?.fields || {};
      const text = fields.text?.stringValue || '';
      
      // Parse the text field which contains structured data
      const lines = text.split('\n');
      const extractiveAnswers: string[] = [];
      const documentContexts: string[] = [];
      let title = '';
      let link = '';
      let entityType = '';
      let sourceType = '';
      let canFetchRawContent = false;
      
      lines.forEach((line: string) => {
        if (line.startsWith('extractive_answers:')) {
          const answer = line.replace('extractive_answers:', '').trim();
          if (answer) extractiveAnswers.push(answer);
        } else if (line.startsWith('document_contexts:')) {
          const context = line.replace('document_contexts:', '').trim();
          if (context) documentContexts.push(context);
        } else if (line.startsWith('title:')) {
          title = line.replace('title:', '').trim();
        } else if (line.startsWith('link:')) {
          link = line.replace('link:', '').trim();
        } else if (line.startsWith('entity_type:')) {
          entityType = line.replace('entity_type:', '').trim();
        } else if (line.startsWith('source_type:')) {
          sourceType = line.replace('source_type:', '').trim();
        } else if (line.startsWith('can_fetch_raw_content:')) {
          canFetchRawContent = line.replace('can_fetch_raw_content:', '').trim() === 'true';
        }
      });

      return {
        title,
        link,
        extractiveAnswers,
        documentContexts,
        entityType,
        sourceType,
        canFetchRawContent,
        url: fields.url?.stringValue,
        document: fields.document?.stringValue,
        debugId: fields.debugId?.stringValue,
        fullText: text // Keep full text for fallback
      };
    });

    if (convertedResults.length > 0) {
      details.push(
        <div key="converted-results" className="mt-2 space-y-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Конвертовано результатів: {convertedResults.length}
          </div>
          <div className="space-y-2">
            {convertedResults.map((result: any, idx: number) => (
              <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                {result.title && (
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {result.title}
                  </div>
                )}
                {result.extractiveAnswers.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Витягнуті відповіді:</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-600">
                      {result.extractiveAnswers.join('\n')}
                    </div>
                  </div>
                )}
                {result.documentContexts.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Контекст документа:</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-32 overflow-y-auto">
                      {result.documentContexts.join('\n')}
                    </div>
                  </div>
                )}
                {result.entityType && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Тип сутності:</span> {result.entityType}
                  </div>
                )}
                {result.sourceType && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Тип джерела:</span> {result.sourceType}
                  </div>
                )}
                {result.canFetchRawContent && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Можна отримати повний контент:</span> Так
                  </div>
                )}
                {result.link && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">
                    <span className="font-medium">Посилання:</span> {result.link}
                  </div>
                )}
                {result.url && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">
                    <span className="font-medium">URL:</span>{' '}
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      {result.url}
                    </a>
                  </div>
                )}
                {result.document && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">
                    <span className="font-medium">Document ID:</span> {result.document}
                  </div>
                )}
                {result.debugId && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">
                    <span className="font-medium">Debug ID:</span> {result.debugId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // ReAct turn - show generated response
  if (stepName === 'ReAct turn' && step.responses?.length > 0) {
    const responseText = step.responses[0]?.structValue?.fields?.text?.stringValue || '';
    if (responseText) {
      details.push(
        <div key="react-response" className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
          <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Згенерована відповідь:</div>
          <div className="text-xs text-green-900 dark:text-green-100">{responseText}</div>
        </div>
      );
    }
  }

  // Parse ReAct Answer - show info
  if (stepName === 'Parse ReAct Answer' && step.info) {
    details.push(
      <div key="parse-info" className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Інформація:</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{step.info}</div>
      </div>
    );
  }

  // Show info if available and not already shown
  if (step.info && stepName !== 'Parse ReAct Answer' && details.length === 0) {
    details.push(
      <div key="step-info" className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
        {step.info}
      </div>
    );
  }

  // If no specific details were rendered but there are responses, show raw response data
  if (details.length === 0 && step.responses?.length > 0) {
    step.responses.forEach((response: any, idx: number) => {
      const fields = response.structValue?.fields || {};
      const responseDetails: JSX.Element[] = [];
      
      if (fields.text?.stringValue) {
        responseDetails.push(
          <div key={`text-${idx}`} className="mb-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Текст:</div>
            <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-600 whitespace-pre-wrap break-words">
              {fields.text.stringValue}
            </div>
          </div>
        );
      }
      
      if (fields.url?.stringValue) {
        responseDetails.push(
          <div key={`url-${idx}`} className="text-xs text-gray-600 dark:text-gray-400 break-all mb-1">
            <span className="font-medium">URL:</span>{' '}
            <a href={fields.url.stringValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              {fields.url.stringValue}
            </a>
          </div>
        );
      }
      
      if (fields.document?.stringValue) {
        responseDetails.push(
          <div key={`doc-${idx}`} className="text-xs text-gray-600 dark:text-gray-400 break-all mb-1">
            <span className="font-medium">Document ID:</span> {fields.document.stringValue}
          </div>
        );
      }
      
      if (fields.debugId?.stringValue) {
        responseDetails.push(
          <div key={`debug-${idx}`} className="text-xs text-gray-600 dark:text-gray-400 break-all mb-1">
            <span className="font-medium">Debug ID:</span> {fields.debugId.stringValue}
          </div>
        );
      }
      
      if (responseDetails.length > 0) {
        details.push(
          <div key={`response-${idx}`} className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            {responseDetails}
          </div>
        );
      }
    });
  }

  return details;
}

export const DiagnosticSteps: React.FC<DiagnosticStepsProps> = ({ diagnosticInfo }) => {
  const steps = extractSteps(diagnosticInfo);
  const executionResult = extractExecutionResult(diagnosticInfo);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // If no steps found, don't render
  if (steps.length === 0) {
    return null;
  }

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Execution Steps */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Кроки виконання</span>
        </div>
        <div className="pl-6 space-y-3">
          {steps.map((step, index) => {
            const isOk = step.status === 'OK';
            const stepNameUk = getStepNameUk(step.name);
            const isExpanded = expandedSteps.has(index);
            const hasDetails = step.responses?.length > 0 || step.info;
            const stepDetails = renderStepDetails(step, step.name);

            return (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <div className="flex items-start space-x-3 p-2">
                  <div className={`flex-shrink-0 mt-0.5 ${isOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isOk ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">
                        Крок {index + 1}: {stepNameUk}
                      </span>
                      {step.duration !== null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({step.duration}ms)
                        </span>
                      )}
                      {isOk && (
                        <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                      )}
                    </div>
                    
                    {/* Expandable details */}
                    {hasDetails && (
                      <button
                        onClick={() => toggleStep(index)}
                        className="mt-2 flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>{isExpanded ? 'Приховати деталі' : 'Показати деталі'}</span>
                      </button>
                    )}
                    
                    {/* Step details */}
                    {isExpanded && hasDetails && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        {stepDetails}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Result */}
      {executionResult.language && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
            <FileText className="w-4 h-4" />
            <span>Результат виконання</span>
          </div>
          <div className="pl-6 space-y-1.5">
            {executionResult.language && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Мова:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {getLanguageName(executionResult.language)}
                </span>
              </div>
            )}
            {executionResult.responseType && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Тип відповіді:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {getResponseTypeUk(executionResult.responseType)}
                </span>
              </div>
            )}
            {executionResult.responseReason && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Причина відповіді:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {getResponseReasonUk(executionResult.responseReason)}
                </span>
              </div>
            )}
            {executionResult.latency !== undefined && executionResult.latency !== null && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Затримка:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {executionResult.latency}ms
                </span>
              </div>
            )}
            {(executionResult.faqCitation || executionResult.unstructuredCitation || executionResult.websiteCitation) && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Цитування:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {[
                    executionResult.faqCitation && 'FAQ',
                    executionResult.unstructuredCitation && 'Документи',
                    executionResult.websiteCitation && 'Веб-сайти'
                  ].filter(Boolean).join(', ') || 'Немає'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

