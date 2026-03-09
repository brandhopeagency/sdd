/**
 * Google Cloud Storage Service
 * 
 * Handles saving and retrieving conversation data from GCS
 */

import { Storage } from '@google-cloud/storage';
import type { StoredConversation, ConversationMetadata } from '../types/conversation';
import type { AgentMemorySystemMessage } from '../types/agentMemory';
import { createHash } from 'crypto';

// Initialize GCS client (uses Application Default Credentials in Cloud Run)
const storage = new Storage();

/**
 * Get bucket name from environment
 */
function getBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable not set');
  }
  return bucketName;
}

function sanitizePathSegment(value: string): string {
  // Keep it simple and safe for GCS object names.
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function stableShortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/**
 * Generate GCS path for a conversation
 * Pattern: incoming/{userId}/{sessionId}.{extension}
 */
function getConversationPath(userId: string | null, sessionId: string, extension: 'json' | 'jsonl'): string {
  const userFolder = userId || 'anonymous';
  return `incoming/${userFolder}/${sessionId}.${extension}`;
}

/**
 * Generate GCS path for agent memory (system messages).
 * Pattern: memory/{principalId}/system_messages.json
 */
function getAgentMemoryPath(principalId: string): string {
  // IMPORTANT: include a hash suffix to avoid collisions from sanitization
  // (e.g., "guest_a/b" -> "guest_a_b" would otherwise collide with "guest_a_b").
  const principalFolder = `${sanitizePathSegment(principalId)}_${stableShortHash(principalId)}`;
  return `memory/${principalFolder}/system_messages.json`;
}

/**
 * Save conversation as JSON
 */
export async function saveConversationJSON(conversation: StoredConversation): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const path = getConversationPath(conversation.userId, conversation.sessionId, 'json');
  const file = bucket.file(path);

  const jsonContent = JSON.stringify(conversation, null, 2);
  
  await file.save(jsonContent, {
    contentType: 'application/json',
    metadata: {
      sessionId: conversation.sessionId,
      userId: conversation.userId || 'anonymous',
      messageCount: conversation.messages.length.toString(),
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt
    }
  });

  console.log(`[GCS] Saved conversation JSON to gs://${bucketName}/${path}`);
  return path;
}

/**
 * Save conversation as JSONL (one message per line)
 */
export async function saveConversationJSONL(conversation: StoredConversation): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const path = getConversationPath(conversation.userId, conversation.sessionId, 'jsonl');
  const file = bucket.file(path);

  // Create JSONL content - one message per line
  const jsonlLines = conversation.messages.map(msg => JSON.stringify(msg));
  const jsonlContent = jsonlLines.join('\n');
  
  await file.save(jsonlContent, {
    contentType: 'application/x-ndjson',
    metadata: {
      sessionId: conversation.sessionId,
      userId: conversation.userId || 'anonymous',
      messageCount: conversation.messages.length.toString(),
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt
    }
  });

  console.log(`[GCS] Saved conversation JSONL to gs://${bucketName}/${path}`);
  return path;
}

/**
 * Save conversation in both formats (JSON and JSONL)
 */
export async function saveConversation(conversation: StoredConversation): Promise<{ jsonPath: string; jsonlPath: string }> {
  const [jsonPath, jsonlPath] = await Promise.all([
    saveConversationJSON(conversation),
    saveConversationJSONL(conversation)
  ]);

  return { jsonPath, jsonlPath };
}

/**
 * Retrieve conversation from GCS
 */
export async function getConversation(gcsPath: string): Promise<StoredConversation> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Conversation not found at gs://${bucketName}/${gcsPath}`);
  }

  const [content] = await file.download();
  const conversation = JSON.parse(content.toString('utf-8')) as StoredConversation;

  console.log(`[GCS] Retrieved conversation from gs://${bucketName}/${gcsPath}`);
  return conversation;
}

/**
 * Retrieve agent memory system messages from GCS.
 * Returns [] if the file does not exist yet.
 */
export async function getAgentMemorySystemMessages(principalId: string): Promise<AgentMemorySystemMessage[]> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const path = getAgentMemoryPath(principalId);
  const file = bucket.file(path);

  const [exists] = await file.exists();
  if (!exists) return [];

  const [content] = await file.download();
  const parsed = JSON.parse(content.toString('utf-8')) as unknown;

  if (!Array.isArray(parsed)) return [];

  // Validate minimal shape; ignore malformed entries.
  const messages = parsed
    .filter((m) => m && typeof m === 'object')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => ({
      role: 'system' as const,
      content: typeof m.content === 'string' ? m.content : '',
      meta: m.meta && typeof m.meta === 'object' ? m.meta : undefined
    }))
    .filter((m) => m.content.trim().length > 0);

  console.log(`[GCS] Retrieved agent memory for principal: ${principalId} from gs://${bucketName}/${path}`);
  return messages;
}

/**
 * Save agent memory system messages to GCS.
 */
export async function saveAgentMemorySystemMessages(
  principalId: string,
  messages: AgentMemorySystemMessage[]
): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const path = getAgentMemoryPath(principalId);
  const file = bucket.file(path);

  const jsonContent = JSON.stringify(messages, null, 2);

  await file.save(jsonContent, {
    contentType: 'application/json',
    metadata: {
      principalId,
      messageCount: messages.length.toString(),
      updatedAt: new Date().toISOString()
    }
  });

  console.log(`[GCS] Saved agent memory to gs://${bucketName}/${path}`);
  return path;
}

/**
 * List conversations for a specific user
 */
export async function listConversations(userId?: string): Promise<ConversationMetadata[]> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);

  // Determine prefix based on userId
  const prefix = userId ? `incoming/${userId}/` : 'incoming/';

  // List only JSON files (not JSONL)
  const [files] = await bucket.getFiles({
    prefix,
    matchGlob: '**/*.json'
  });

  const conversations: ConversationMetadata[] = [];

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    
    if (metadata.metadata) {
      const customMeta = metadata.metadata as Record<string, string>;
      conversations.push({
        id: customMeta.sessionId || '', // Using sessionId as id
        sessionId: customMeta.sessionId || '',
        userId: customMeta.userId === 'anonymous' ? null : customMeta.userId,
        userName: undefined, // Will be populated by caller if needed
        status: 'ended' as const, // GCS conversations are always ended
        startedAt: customMeta.startedAt || '',
        endedAt: customMeta.endedAt || '',
        messageCount: parseInt(customMeta.messageCount || '0', 10),
        languageCode: customMeta.languageCode || 'uk',
        gcsPath: file.name
      });
    }
  }

  // Sort by startedAt descending (most recent first)
  conversations.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  console.log(`[GCS] Listed ${conversations.length} conversations for user: ${userId || 'all'}`);
  return conversations;
}

/**
 * Delete a conversation from GCS (both JSON and JSONL)
 */
export async function deleteConversation(userId: string | null, sessionId: string): Promise<void> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);

  const jsonPath = getConversationPath(userId, sessionId, 'json');
  const jsonlPath = getConversationPath(userId, sessionId, 'jsonl');

  await Promise.all([
    bucket.file(jsonPath).delete().catch(() => {}), // Ignore if doesn't exist
    bucket.file(jsonlPath).delete().catch(() => {}) // Ignore if doesn't exist
  ]);

  console.log(`[GCS] Deleted conversation: ${sessionId}`);
}

/**
 * Delete a conversation from GCS by its stored path.
 * Best-effort: deletes both JSON and JSONL siblings.
 */
export async function deleteConversationByGcsPath(gcsPath: string): Promise<void> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);

  const paths = new Set<string>([gcsPath]);
  if (gcsPath.endsWith('.json')) {
    paths.add(gcsPath.replace(/\.json$/, '.jsonl'));
  } else if (gcsPath.endsWith('.jsonl')) {
    paths.add(gcsPath.replace(/\.jsonl$/, '.json'));
  }

  await Promise.all(
    Array.from(paths).map(p => bucket.file(p).delete().catch(() => {})) // Ignore if doesn't exist
  );

  console.log(`[GCS] Deleted conversation by path: ${gcsPath}`);
}

/**
 * Check if GCS is configured and accessible
 */
export async function checkGCSConnection(): Promise<boolean> {
  try {
    const bucketName = getBucketName();
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      console.error(`[GCS] Bucket does not exist: ${bucketName}`);
      return false;
    }

    console.log(`[GCS] Connected to bucket: ${bucketName}`);
    return true;
  } catch (error) {
    console.error('[GCS] Connection check failed:', error);
    return false;
  }
}

