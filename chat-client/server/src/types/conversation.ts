/**
 * Conversation Storage Types
 * 
 * These types define the structure for storing complete conversation data
 * in GCS, including all technical details from Dialogflow CX.
 */

import type { AgentMemorySystemMessage } from './agentMemory';

/**
 * Tool use action from Dialogflow CX
 */
export interface ToolUseAction {
  toolName: string;
  inputParameters: Record<string, unknown>;
  outputParameters: Record<string, unknown>;
}

/**
 * Agent utterance action from Dialogflow CX
 */
export interface AgentUtteranceAction {
  text: string;
}

/**
 * Action from Dialogflow CX generative info
 */
export interface DialogflowAction {
  actionType: string;  // AGENT_UTTERANCE, TOOL_USE, etc.
  agentUtterance?: AgentUtteranceAction;
  toolUse?: ToolUseAction;
}

/**
 * Generative AI information (RAG, Chain of Thought)
 */
export interface GenerativeInfo {
  actionTracingInfo?: {
    actions: DialogflowAction[];
  };
  currentPage?: {
    name: string;
    displayName: string;
  };
}

/**
 * Webhook execution status
 */
export interface WebhookStatus {
  webhookId: string;
  displayName: string;
  callSucceeded: boolean;
  latencyMs: number;
}

/**
 * Alternative intent match
 */
export interface AlternativeIntent {
  intent: string;
  confidence: number;
}

/**
 * Execution step interval (timing information)
 */
export interface ExecutionStepInterval {
  start_time?: number;
  complete_time?: number;
}

/**
 * Execution step status
 */
export interface ExecutionStepStatus {
  code?: string;
}

/**
 * Execution step response
 */
export interface ExecutionStepResponse {
  text?: string;
  url?: string;
  document?: string;
  debugId?: string;
}

/**
 * Single execution step in DataStore Execution Sequence
 */
export interface ExecutionStep {
  name?: string;
  interval?: ExecutionStepInterval;
  responses?: ExecutionStepResponse[];
  status?: ExecutionStepStatus;
  info?: string;
}

/**
 * Execution result from DataStore Execution Sequence
 */
export interface ExecutionResult {
  language?: string;
  response_type?: string;
  response_reason?: string;
  latency?: number;
  faq_citation?: boolean;
  unstructured_citation?: boolean;
  website_citation?: boolean;
  ucs_fallback?: boolean;
  banned_phrase?: string;
  banned_phrase_check_type?: string;
}

/**
 * Additional info from DataStore Execution Sequence
 */
export interface AdditionalInfo {
  user_query?: string;
  rewritten_query?: string;
  tracking_id?: string;
  agent_project_number?: string;
  ucs_project_number?: string;
  search_results_used_in_main_prompt?: string;
}

/**
 * DataStore Execution Sequence structure
 */
export interface DataStoreExecutionSequence {
  steps?: ExecutionStep[];
  executionResult?: ExecutionResult;
  additionalInfo?: AdditionalInfo;
}

/**
 * Diagnostic information from Dialogflow CX
 * Can contain either legacy format or new format with fields
 */
export interface DiagnosticInfo {
  // Legacy format
  alternativeMatchedIntents?: AlternativeIntent[];
  webhookPayloads?: Record<string, unknown>;
  executionSequence?: unknown[];
  
  // New format with fields structure
  fields?: {
    'Response Id'?: {
      stringValue?: string;
      kind?: string;
    };
    'DataStore Execution Sequence'?: {
      structValue?: {
        fields?: {
          ''?: {
            structValue?: {
              fields?: {
                steps?: {
                  listValue?: {
                    values?: Array<{
                      structValue?: {
                        fields?: {
                          name?: { stringValue?: string; kind?: string };
                          interval?: {
                            structValue?: {
                              fields?: {
                                start_time?: { numberValue?: number; kind?: string };
                                complete_time?: { numberValue?: number; kind?: string };
                              };
                            };
                            kind?: string;
                          };
                          responses?: {
                            listValue?: {
                              values?: Array<{
                                structValue?: {
                                  fields?: {
                                    text?: { stringValue?: string; kind?: string };
                                    url?: { stringValue?: string; kind?: string };
                                    document?: { stringValue?: string; kind?: string };
                                    debugId?: { stringValue?: string; kind?: string };
                                  };
                                };
                                kind?: string;
                              }>;
                            };
                            kind?: string;
                          };
                          status?: {
                            structValue?: {
                              fields?: {
                                code?: { stringValue?: string; kind?: string };
                              };
                            };
                            kind?: string;
                          };
                          info?: { stringValue?: string; kind?: string };
                        };
                      };
                      kind?: string;
                    }>;
                  };
                };
                executionResult?: {
                  structValue?: {
                    fields?: {
                      language?: { stringValue?: string; kind?: string };
                      response_type?: { stringValue?: string; kind?: string };
                      response_reason?: { stringValue?: string; kind?: string };
                      latency?: { numberValue?: number; kind?: string };
                      faq_citation?: { boolValue?: boolean; kind?: string };
                      unstructured_citation?: { boolValue?: boolean; kind?: string };
                      website_citation?: { boolValue?: boolean; kind?: string };
                      ucs_fallback?: { boolValue?: boolean; kind?: string };
                      banned_phrase?: { stringValue?: string; kind?: string };
                      banned_phrase_check_type?: { stringValue?: string; kind?: string };
                    };
                  };
                  kind?: string;
                };
                additionalInfo?: {
                  structValue?: {
                    fields?: {
                      user_query?: { stringValue?: string; kind?: string };
                      rewritten_query?: { stringValue?: string; kind?: string };
                      tracking_id?: { stringValue?: string; kind?: string };
                      agent_project_number?: { stringValue?: string; kind?: string };
                      ucs_project_number?: { stringValue?: string; kind?: string };
                      search_results_used_in_main_prompt?: { stringValue?: string; kind?: string };
                    };
                  };
                  kind?: string;
                };
              };
            };
          };
        };
      };
      kind?: string;
    };
    'Session Id'?: {
      stringValue?: string;
      kind?: string;
    };
  };
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysis {
  score: number;      // -1.0 to 1.0
  magnitude: number;  // 0.0 to infinity
}

/**
 * Flow/page information
 */
export interface FlowInfo {
  currentPage: string;
  previousPage?: string;
  transitionReason?: string;
}

/**
 * Intent information
 */
export interface IntentInfo {
  name: string;
  displayName: string;
  confidence: number;
}

/**
 * Match information from Dialogflow CX
 */
export interface MatchInfo {
  type: string;      // INTENT, EVENT, NO_MATCH, NO_INPUT, etc.
  confidence: number;
  matchType: string; // MATCH_TYPE_UNSPECIFIED, INTENT, DIRECT_INTENT, PARAMETER_FILLING, NO_MATCH, NO_INPUT, EVENT
  parameters: Record<string, unknown>;
}

/**
 * User feedback on a message
 */
export interface MessageFeedback {
  rating: 1 | 2 | 3 | 4 | 5; // 5-point rating scale
  comment: string | null;
  submittedAt: string; // ISO timestamp
}

/**
 * Complete stored message with all technical details
 */
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  
  // Core Dialogflow data
  intent?: IntentInfo;
  
  // Match information
  match?: MatchInfo;
  
  // Generative AI (RAG, Chain of Thought)
  generativeInfo?: GenerativeInfo;
  
  // Webhook/Tool calls
  webhookStatuses?: WebhookStatus[];
  
  // Diagnostic information
  diagnosticInfo?: DiagnosticInfo;
  
  // Sentiment analysis
  sentiment?: SentimentAnalysis;
  
  // Flow information
  flowInfo?: FlowInfo;
  
  // Performance
  responseTimeMs?: number;
  
  /**
   * System prompts used to produce this assistant response (debugging / moderation).
   * NOTE: This is NOT the assistant response content itself.
   */
  systemPrompts?: {
    agentMemorySystemMessages?: AgentMemorySystemMessage[];
  };

  // User feedback
  feedback?: MessageFeedback;
}

/**
 * Complete stored conversation
 */
export interface StoredConversation {
  sessionId: string;
  userId: string | null;
  startedAt: string;
  endedAt: string;
  status: 'active' | 'ended' | 'expired';
  messages: StoredMessage[];
  metadata: {
    messageCount: number;
    languageCode: string;
    dialogflowSessionId: string;
    environment?: string;
  };
}

/**
 * Session metadata (stored in database)
 */
export interface SessionMetadata {
  id: string;
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  languageCode: string;
  gcsPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation metadata for listing
 */
export interface ConversationMetadata {
  id: string; // Database session ID
  sessionId: string;
  userId: string | null;
  userName?: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: string;
  endedAt: string;
  messageCount: number;
  languageCode: string;
  gcsPath: string;
}

