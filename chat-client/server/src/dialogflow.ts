import { SessionsClient } from '@google-cloud/dialogflow-cx';
import type {
  StoredMessage,
  IntentInfo,
  MatchInfo,
  GenerativeInfo,
  WebhookStatus,
  DiagnosticInfo,
  SentimentAnalysis,
  FlowInfo
} from './types/conversation';
import type { AgentMemorySystemMessage } from './types/agentMemory';

export interface DialogflowResponse {
  messages: string[];
  intent: string;
  confidence: number;
  parameters: Record<string, unknown>;
  
  // Extended technical information
  intentInfo?: IntentInfo;
  match?: MatchInfo;
  generativeInfo?: GenerativeInfo;
  webhookStatuses?: WebhookStatus[];
  diagnosticInfo?: DiagnosticInfo;
  sentiment?: SentimentAnalysis;
  flowInfo?: FlowInfo;
}

export type AuthMethod = 'service_account' | 'mock';

// Lazy initialization of client to avoid errors if not configured
let sessionsClient: SessionsClient | null = null;

/**
 * Get configuration from environment (lazy, after dotenv is loaded)
 */
function getConfig() {
  return {
    projectId: process.env.DIALOGFLOW_PROJECT_ID,
    location: process.env.DIALOGFLOW_LOCATION || 'global',
    agentId: process.env.DIALOGFLOW_AGENT_ID,
    // Check for explicit credentials OR Cloud Run environment (K_SERVICE is auto-set by Cloud Run)
    canUseDialogflow: !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.K_SERVICE
  };
}

/**
 * Determine which authentication method to use
 */
export function getAuthMethod(): AuthMethod {
  const config = getConfig();
  
  // Check if basic config exists
  if (!config.projectId || !config.agentId) {
    return 'mock';
  }
  
  // Use Dialogflow if credentials available or running on Cloud Run
  if (config.canUseDialogflow) {
    return 'service_account';
  }
  
  // Fallback: Mock responses
  return 'mock';
}

function getSessionsClient(): SessionsClient {
  const { location } = getConfig();
  if (!sessionsClient) {
    sessionsClient = new SessionsClient({
      apiEndpoint: `${location}-dialogflow.googleapis.com`
    });
  }
  return sessionsClient;
}

/**
 * Generate mock response for development/testing
 */
function getMockResponse(text: string, languageCode: string, userId?: string | null): DialogflowResponse {
  const lowerText = text.toLowerCase();
  
  const responses: Record<string, Record<string, { intent: string; messages: string[] }>> = {
    uk: {
      'привіт': { intent: 'welcome', messages: ['Вітаю! Як я можу вам допомогти сьогодні?'] },
      'допоможи': { intent: 'help', messages: ['Я тут, щоб вас підтримати. Розкажіть, що вас турбує.'] },
      'тривога': { intent: 'anxiety', messages: ['Тривога — це природна реакція. Давайте поговоримо про те, що ви відчуваєте.'] },
      'сумно': { intent: 'sadness', messages: ['Мені шкода, що вам зараз сумно. Чи можете розповісти більше?'] },
      'дякую': { intent: 'thanks', messages: ['Завжди радий допомогти! Бережіть себе.'] },
      'default': { intent: 'default', messages: ['Дякую за ваше повідомлення. Чи можете розповісти більше?'] }
    },
    en: {
      'hello': { intent: 'welcome', messages: ['Hello! How can I help you today?'] },
      'help': { intent: 'help', messages: ['I\'m here to support you. Tell me what\'s on your mind.'] },
      'anxiety': { intent: 'anxiety', messages: ['Anxiety is a natural response. Let\'s talk about what you\'re feeling.'] },
      'sad': { intent: 'sadness', messages: ['I\'m sorry you\'re feeling sad. Can you tell me more?'] },
      'thanks': { intent: 'thanks', messages: ['Always happy to help! Take care.'] },
      'default': { intent: 'default', messages: ['Thank you for your message. Can you tell me more?'] }
    },
    ru: {
      'привет': { intent: 'welcome', messages: ['Здравствуйте! Как я могу вам помочь?'] },
      'помоги': { intent: 'help', messages: ['Я здесь, чтобы поддержать вас. Расскажите, что вас беспокоит.'] },
      'тревога': { intent: 'anxiety', messages: ['Тревога — это естественная реакция. Давайте поговорим о ваших чувствах.'] },
      'грустно': { intent: 'sadness', messages: ['Мне жаль, что вам грустно. Можете рассказать подробнее?'] },
      'спасибо': { intent: 'thanks', messages: ['Всегда рад помочь! Берегите себя.'] },
      'default': { intent: 'default', messages: ['Спасибо за сообщение. Можете рассказать подробнее?'] }
    }
  };

  const langResponses = responses[languageCode] || responses.uk;
  
  for (const [keyword, response] of Object.entries(langResponses)) {
    if (keyword !== 'default' && lowerText.includes(keyword)) {
      return {
        ...response,
        confidence: 0.85,
        parameters: {}
      };
    }
  }
  
  return {
    ...langResponses.default,
    confidence: 0.5,
    parameters: {}
  };
}

/**
 * Convert protobuf Struct/Value (as returned by Dialogflow CX Node SDK) to plain JSON
 */
function convertProtoValue(value: any): any {
  if (value === null || value === undefined) return value;

  if (typeof value !== 'object') return value;

  if (value.structValue) {
    const result: Record<string, any> = {};
    const fields = value.structValue.fields || {};
    for (const [key, v] of Object.entries(fields)) {
      result[key] = convertProtoValue(v);
    }
    return result;
  }

  if (value.listValue) {
    const list = value.listValue.values || [];
    return list.map((v: any) => convertProtoValue(v));
  }

  if ('stringValue' in value) return value.stringValue;
  if ('numberValue' in value) return value.numberValue;
  if ('boolValue' in value) return value.boolValue;
  if ('nullValue' in value) return null;

  return value;
}

/**
 * Send message using SDK with Service Account
 */
async function sendWithServiceAccount(
  sessionId: string,
  text: string,
  languageCode: string,
  userId?: string | null,
  agentMemorySystemMessages?: AgentMemorySystemMessage[]
): Promise<DialogflowResponse> {
  const { projectId, location, agentId } = getConfig();
  const client = getSessionsClient();
  
  const sessionPath = client.projectLocationAgentSessionPath(
    projectId!,
    location,
    agentId!,
    sessionId
  );

  const agentMemoryJson =
    agentMemorySystemMessages && agentMemorySystemMessages.length > 0
      ? JSON.stringify(agentMemorySystemMessages.slice(0, 12)) // keep small; memory should be aggregated anyway
      : null;

  const parameterFields: Record<string, any> = {};
  if (userId) {
    parameterFields.userId = { stringValue: userId, kind: 'stringValue' };
  }
  if (agentMemoryJson) {
    parameterFields.agentMemorySystemMessages = { stringValue: agentMemoryJson, kind: 'stringValue' };
  }

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text
      },
      languageCode: languageCode
    },
    queryParams: {
      // Enable retrieval of generative AI information (RAG, tool calls, chain of thought)
      analyzeQueryTextSentiment: true,
      // Request diagnostic info and execution details
      webhookHeaders: {},
      // Include current page and flow information
      currentPage: undefined,
      // Populate all available diagnostic information
      populateDataStoreConnectionSignals: true,
      // Pass userId + memory as session parameters (accessible in webhooks/intents)
      parameters: Object.keys(parameterFields).length
        ? {
            fields: parameterFields
          }
        : undefined
    }
  };

  if (userId) {
    console.log(`[Dialogflow] Passing userId parameter to session: ${userId}`);
  }

  const [response] = await client.detectIntent(request);
  const queryResult = response.queryResult;
  
  if (!queryResult) {
    throw new Error('No query result in Dialogflow response');
  }

  // Log full response for debugging generativeInfo
  console.log('[Dialogflow] Full queryResult keys:', Object.keys(queryResult));
  if ((queryResult as any).generativeInfo) {
    console.log('[Dialogflow] generativeInfo found:', JSON.stringify((queryResult as any).generativeInfo, null, 2));
  } else {
    console.log('[Dialogflow] No generativeInfo in response');
  }
  if (queryResult.diagnosticInfo) {
    console.log('[Dialogflow] diagnosticInfo found:', JSON.stringify(queryResult.diagnosticInfo, null, 2));
  }

  // Extract messages
  const messages: string[] = [];
  if (queryResult.responseMessages) {
    for (const message of queryResult.responseMessages) {
      if (message.text?.text) {
        messages.push(...message.text.text);
      }
    }
  }

  // Basic intent and parameters
  const intent = queryResult.intent?.displayName || 'unknown';
  const confidence = queryResult.intentDetectionConfidence || 0;
  
  const parameters: Record<string, unknown> = {};
  if (queryResult.parameters?.fields) {
    for (const [key, value] of Object.entries(queryResult.parameters.fields)) {
      parameters[key] = value.stringValue || value.numberValue || value.boolValue;
    }
  }

  // Extract intent info
  const intentInfo: IntentInfo | undefined = queryResult.intent ? {
    name: queryResult.intent.name || '',
    displayName: queryResult.intent.displayName || 'unknown',
    confidence: confidence
  } : undefined;

  // Extract match info (only if meaningful data exists)
  let match: MatchInfo | undefined;
  if (queryResult.match && queryResult.match.matchType) {
    match = {
      type: String(queryResult.match.matchType),
      confidence: queryResult.match.confidence || confidence,
      matchType: String(queryResult.match.matchType),
      parameters: parameters
    };
  }

  // Extract generative info (supports both typed object and protobuf Struct)
  let generativeInfo: GenerativeInfo | undefined;
  const genInfoRaw = (queryResult as any).generativeInfo;
  if (genInfoRaw) {
    const genInfo = genInfoRaw.fields ? convertProtoValue(genInfoRaw) : genInfoRaw;
    
    if (genInfo.actionTracingInfo?.actions?.length > 0 || genInfo.currentPage) {
      generativeInfo = {
        actionTracingInfo: genInfo.actionTracingInfo?.actions?.length > 0 ? {
          actions: (genInfo.actionTracingInfo.actions || []).map((action: any) => ({
            actionType: action.actionType || 'UNKNOWN',
            agentUtterance: action.agentUtterance ? {
              text: action.agentUtterance.text || ''
            } : undefined,
            toolUse: action.toolUse ? {
              toolName: action.toolUse.tool || action.toolUse.toolName || '',
              inputParameters: action.toolUse.inputParameters || action.toolUse.inputActionParameters || {},
              outputParameters: action.toolUse.outputParameters || action.toolUse.outputActionParameters || {}
            } : undefined
          }))
        } : undefined,
        currentPage: genInfo.currentPage ? {
          name: genInfo.currentPage.name || '',
          displayName: genInfo.currentPage.displayName || ''
        } : undefined
      };
    } else {
      // If generative info exists but without actions/page, pass through raw content for visibility
      if (Object.keys(genInfo || {}).length > 0) {
        generativeInfo = genInfo as any;
      }
    }
  }

  // Extract webhook statuses
  let webhookStatuses: WebhookStatus[] | undefined;
  if (queryResult.webhookStatuses && Array.isArray(queryResult.webhookStatuses) && queryResult.webhookStatuses.length > 0) {
    webhookStatuses = queryResult.webhookStatuses.map((status: any) => ({
      webhookId: status.webhookId || status.id || '',
      displayName: status.displayName || status.name || '',
      callSucceeded: status.callSucceeded !== false,
      latencyMs: status.latencyMs || 0
    }));
  }

  // Extract diagnostic info (supports protobuf Struct)
  let diagnosticInfo: DiagnosticInfo | undefined;
  if (queryResult.diagnosticInfo) {
    const diagInfoRaw = queryResult.diagnosticInfo as any;
    const diagInfo = diagInfoRaw.fields ? convertProtoValue(diagInfoRaw) : diagInfoRaw;
    
    // Check for legacy format
    if (diagInfo.alternativeMatchedIntents || diagInfo.webhookPayloads || diagInfo.executionSequence) {
      diagnosticInfo = {
        alternativeMatchedIntents: diagInfo.alternativeMatchedIntents,
        webhookPayloads: diagInfo.webhookPayloads,
        executionSequence: diagInfo.executionSequence
      };
    } else if (diagInfo.fields) {
      // New format with fields structure (DataStore Execution Sequence)
      // Preserve the entire structure including fields
      diagnosticInfo = {
        fields: diagInfo.fields
      };
    } else if (Object.keys(diagInfo || {}).length > 0) {
      // Pass through any other diagnostic content for visibility
      diagnosticInfo = diagInfo;
    }
  }

  // Extract sentiment
  let sentiment: SentimentAnalysis | undefined;
  if (queryResult.sentimentAnalysisResult) {
    const sentimentResult = queryResult.sentimentAnalysisResult as any;
    
    // Only create sentiment if there's actual data (score and magnitude can be 0, so check if they exist)
    if (sentimentResult.score !== undefined || sentimentResult.magnitude !== undefined) {
      sentiment = {
        score: sentimentResult.score || 0,
        magnitude: sentimentResult.magnitude || 0
      };
    }
  }

  // Extract flow info
  let flowInfo: FlowInfo | undefined;
  if (queryResult.currentPage) {
    const currentPage = queryResult.currentPage as any;
    const currentPageName = currentPage.displayName || currentPage.name || '';
    
    // Only create flowInfo if there's a valid page name
    if (currentPageName) {
      flowInfo = {
        currentPage: currentPageName,
        previousPage: undefined, // Not directly available in single response
        transitionReason: undefined
      };
    }
  }

  return {
    messages: messages.length > 0 ? messages : ['...'],
    intent,
    confidence,
    parameters,
    intentInfo,
    match,
    generativeInfo,
    webhookStatuses,
    diagnosticInfo,
    sentiment,
    flowInfo
  };
}

/**
 * Send a message to Dialogflow CX and get a response
 * Uses Service Account if configured, otherwise falls back to mock responses
 */
export async function sendMessageToDialogflow(
  sessionId: string,
  text: string,
  languageCode: string = 'uk',
  userId?: string | null,
  agentMemorySystemMessages?: AgentMemorySystemMessage[]
): Promise<DialogflowResponse> {
  const authMethod = getAuthMethod();
  
  console.log(`[Dialogflow] Using auth method: ${authMethod}`, userId ? `with userId: ${userId}` : '');
  
  if (authMethod === 'service_account') {
    return sendWithServiceAccount(sessionId, text, languageCode, userId, agentMemorySystemMessages);
  }
  
  // Mock fallback
  console.log('[Dialogflow] Using mock response (no credentials configured)');
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  return getMockResponse(text, languageCode, userId);
}
