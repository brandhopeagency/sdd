/**
 * Technical Details Component
 * 
 * Displays technical information from Dialogflow CX responses
 * Only visible to users with extended permissions (qa_specialist, researcher, moderator, owner)
 */

import { Brain, Zap, Activity } from 'lucide-react';
import type { FC } from 'react';
import type { ChatMessage } from '../types';
import { useAuthStore } from '../stores/authStore';
import { DiagnosticSteps } from './DiagnosticSteps';

interface TechnicalDetailsProps {
  message: ChatMessage;
  isExpanded: boolean;
}

export const TechnicalDetails: FC<TechnicalDetailsProps> = ({ message, isExpanded }) => {
  const { user } = useAuthStore();

  // Only show for assistant messages
  if (message.role !== 'assistant') {
    return null;
  }

  // Check if user has extended permissions
  const hasExtendedPermissions = user && ['qa_specialist', 'researcher', 'moderator', 'owner'].includes(user.role);
 
  // Only show if user has extended permissions
  if (!hasExtendedPermissions) {
    return null;
  }

  // Check if there's any technical data to display
  const hasTechnicalData = message.metadata && (
    message.metadata.intent ||
    (message.metadata as any).intentInfo ||
    (message.metadata as any).match ||
    (message.metadata as any).generativeInfo ||
    (message.metadata as any).webhookStatuses ||
    (message.metadata as any).diagnosticInfo ||
    (message.metadata as any).sentiment ||
    (message.metadata as any).flowInfo ||
    (message.metadata as any).systemPrompts
  );

  if (!hasTechnicalData) {
    return null;
  }

  if (!isExpanded) {
    return null;
  }

  const systemPrompts = (message.metadata as any).systemPrompts as
    | {
        agentMemorySystemMessages?: Array<{
          role: 'system';
          content: string;
          meta?: Record<string, unknown>;
        }>;
      }
    | undefined;

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Content */}
      <div className="px-3 py-2 space-y-3 text-xs">
          
          {/* Intent Information */}
          {(message.metadata as any).intentInfo && (
            <div className="space-y-1">
              <div className="flex items-center space-x-1 font-medium text-gray-700 dark:text-gray-300">
                <Brain className="w-3 h-3" />
                <span>Intent</span>
              </div>
              <div className="pl-4 space-y-1">
                {(message.metadata as any).intentInfo.displayName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Display Name:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">
                      {(message.metadata as any).intentInfo.displayName}
                    </span>
                  </div>
                )}
                {(message.metadata as any).intentInfo.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Full Name:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
                      {(message.metadata as any).intentInfo.name}
                    </span>
                  </div>
                )}
                {(message.metadata as any).intentInfo.confidence !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">
                      {((message.metadata as any).intentInfo.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match Information */}
          {(message.metadata as any).match && (
            <div className="space-y-1">
              <div className="flex items-center space-x-1 font-medium text-gray-700 dark:text-gray-300">
                <Activity className="w-3 h-3" />
                <span>Match</span>
              </div>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">
                    {(message.metadata as any).match.type || (message.metadata as any).match.matchType}
                  </span>
                </div>
                {(message.metadata as any).match.confidence !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">
                      {((message.metadata as any).match.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parameters */}
          {message.metadata.parameters && Object.keys(message.metadata.parameters).length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-gray-700 dark:text-gray-300">Parameters</div>
              <div className="pl-4 space-y-1">
                {Object.entries(message.metadata.parameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono text-right truncate max-w-[200px]">
                      {JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generative Info (RAG, Chain of Thought) */}
          {(message.metadata as any).generativeInfo && (
            <div className="space-y-1">
              <div className="flex items-center space-x-1 font-medium text-gray-700 dark:text-gray-300">
                <Zap className="w-3 h-3" />
                <span>Generative AI</span>
              </div>
              <div className="pl-4 space-y-2">
                {(message.metadata as any).generativeInfo.actionTracingInfo?.actions?.map((action: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Action {idx + 1}: {action.actionType}
                    </div>
                    {action.toolUse && (
                      <div className="space-y-1 text-xs">
                        <div className="text-gray-600 dark:text-gray-400">
                          Tool: <span className="font-mono">{action.toolUse.toolName}</span>
                        </div>
                        {action.toolUse.inputParameters && Object.keys(action.toolUse.inputParameters).length > 0 && (
                          <div className="text-gray-600 dark:text-gray-400">
                            Input: <pre className="inline font-mono">{JSON.stringify(action.toolUse.inputParameters, null, 2)}</pre>
                          </div>
                        )}
                        {action.toolUse.outputParameters && Object.keys(action.toolUse.outputParameters).length > 0 && (
                          <div className="text-gray-600 dark:text-gray-400">
                            Output: <pre className="inline font-mono">{JSON.stringify(action.toolUse.outputParameters, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                    {action.agentUtterance && (
                      <div className="text-gray-600 dark:text-gray-400">
                        Utterance: {action.agentUtterance.text}
                      </div>
                    )}
                  </div>
                ))}
                {(message.metadata as any).generativeInfo.currentPage && (
                  <div className="text-gray-600 dark:text-gray-400">
                    Page: <span className="font-mono">{(message.metadata as any).generativeInfo.currentPage.displayName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Webhook Statuses */}
          {(message.metadata as any).webhookStatuses && (message.metadata as any).webhookStatuses.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-gray-700 dark:text-gray-300">Webhooks</div>
              <div className="pl-4 space-y-1">
                {(message.metadata as any).webhookStatuses.map((webhook: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{webhook.displayName}:</span>
                    <span className={`font-mono ${webhook.callSucceeded ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {webhook.callSucceeded ? '✓' : '✗'} ({webhook.latencyMs}ms)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentiment Analysis */}
          {(message.metadata as any).sentiment && (
            <div className="space-y-1">
              <div className="flex items-center space-x-1 font-medium text-gray-700 dark:text-gray-300">
                <Activity className="w-3 h-3" />
                <span>Sentiment</span>
              </div>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Score:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">
                    {(message.metadata as any).sentiment.score.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Magnitude:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">
                    {(message.metadata as any).sentiment.magnitude.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Flow Info */}
          {(message.metadata as any).flowInfo && (
            <div className="space-y-1">
              <div className="font-medium text-gray-700 dark:text-gray-300">Flow</div>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Page:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{(message.metadata as any).flowInfo.currentPage}</span>
                </div>
                {(message.metadata as any).flowInfo.previousPage && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Previous Page:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{(message.metadata as any).flowInfo.previousPage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance */}
          {message.metadata.responseTimeMs !== undefined && (
            <div className="space-y-1">
              <div className="font-medium text-gray-700 dark:text-gray-300">Performance</div>
              <div className="pl-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{message.metadata.responseTimeMs}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Info */}
          {(message.metadata as any).diagnosticInfo && (
            <div className="space-y-2">
              <div className="font-medium text-gray-700 dark:text-gray-300">
                Діагностична інформація
              </div>
              
              {/* User-friendly steps display */}
              <DiagnosticSteps diagnosticInfo={(message.metadata as any).diagnosticInfo} />
              
              {/* Collapsed JSON for remaining details */}
              <details className="mt-2">
                <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  Детальна технічна інформація (JSON)
                </summary>
                <div className="mt-2">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto">
                    {JSON.stringify((message.metadata as any).diagnosticInfo, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {/* System prompts (debug) */}
          {systemPrompts && (
            <div className="space-y-2">
              <div className="font-medium text-gray-700 dark:text-gray-300">
                Системні промпти
              </div>

              <details>
                <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  Agent memory (system messages)
                  {systemPrompts.agentMemorySystemMessages?.length
                    ? ` • ${systemPrompts.agentMemorySystemMessages.length}`
                    : ''}
                </summary>
                <div className="mt-2 space-y-2">
                  {systemPrompts.agentMemorySystemMessages && systemPrompts.agentMemorySystemMessages.length > 0 ? (
                    <>
                      {systemPrompts.agentMemorySystemMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                        >
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            #{idx + 1}
                            {m.meta && (m.meta as any).kind ? ` • ${(m.meta as any).kind}` : ''}
                          </div>
                          <pre className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                            {m.content}
                          </pre>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                      Немає agent-memory промптів для цього кроку.
                    </div>
                  )}

                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                      Raw (JSON)
                    </summary>
                    <div className="mt-2">
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 max-h-96 overflow-y-auto">
                        {JSON.stringify(systemPrompts, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              </details>
            </div>
          )}
      </div>
    </div>
  );
};

