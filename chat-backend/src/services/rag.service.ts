import type { RAGCallDetail, RAGDocument } from '@mentalhelpglobal/chat-types';

/**
 * Extract RAG call details from a message's metadata/diagnostic info.
 * RAG data is embedded in the Dialogflow CX execution result metadata
 * under the data_store_execution_sequence path.
 */
export function extractRAGDetails(metadata: any): RAGCallDetail | null {
  if (!metadata) return null;

  // Try direct RAG metadata (if explicitly stored)
  if (metadata.ragCallDetail) {
    return metadata.ragCallDetail as RAGCallDetail;
  }

  // Extract from Dialogflow CX data store execution sequence
  const dataStoreSeq = metadata.diagnostic_info?.data_store_execution_sequence
    ?? metadata.diagnosticInfo?.dataStoreExecutionSequence
    ?? metadata.data_store_execution_sequence;

  if (!dataStoreSeq) return null;

  try {
    const steps = Array.isArray(dataStoreSeq) ? dataStoreSeq : [dataStoreSeq];
    const documents: RAGDocument[] = [];
    let query = '';
    let timestamp = new Date();

    for (const step of steps) {
      const execResult = step.execution_result ?? step.executionResult ?? step;

      // Extract retrieval query
      if (execResult.query || execResult.retrieval_query) {
        query = execResult.query || execResult.retrieval_query;
      }

      // Extract retrieved documents/snippets
      const snippets = execResult.snippets ?? execResult.retrieved_snippets ?? [];
      for (const snippet of snippets) {
        documents.push({
          title: snippet.title ?? snippet.document_title ?? 'Untitled',
          relevanceScore: Number(snippet.relevance_score ?? snippet.confidence ?? 0),
          contentSnippet: snippet.snippet ?? snippet.content ?? snippet.text ?? '',
        });
      }

      // Timestamp
      if (execResult.timestamp) {
        timestamp = new Date(execResult.timestamp);
      }
    }

    if (documents.length === 0 && !query) return null;

    return {
      retrievalQuery: query,
      retrievedDocuments: documents,
      retrievalTimestamp: timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Enrich an array of messages with RAG details extracted from their metadata.
 */
export function enrichMessagesWithRAG(messages: any[]): any[] {
  return messages.map((msg) => {
    const ragDetail = extractRAGDetails(msg.metadata ?? msg.diagnostic_info ?? msg.diagnosticInfo);
    return ragDetail ? { ...msg, ragCallDetail: ragDetail } : msg;
  });
}
