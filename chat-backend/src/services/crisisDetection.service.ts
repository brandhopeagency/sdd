import { getPool } from '../db';
import { createFlag } from './riskFlag.service';

// ── Types ──

export interface CrisisKeyword {
  id: number;
  keyword: string;
  language: string;
  category: string;
  severity: string;
  isPhrase: boolean;
  isActive: boolean;
}

export interface ScanResult {
  flagged: boolean;
  matchedKeywords: string[];
  severity: string;
}

// ── Severity ranking ──

const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

// ── Service functions ──

/**
 * Load all active crisis keywords from the database.
 */
export async function loadKeywords(): Promise<CrisisKeyword[]> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT * FROM crisis_keywords WHERE is_active = true',
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    keyword: row.keyword,
    language: row.language,
    category: row.category,
    severity: row.severity,
    isPhrase: Boolean(row.is_phrase),
    isActive: Boolean(row.is_active),
  }));
}

/**
 * Scan all user messages in a session against active crisis keywords.
 * Returns whether any match was found, the matched keywords, and the highest severity.
 */
export async function scanSessionMessages(sessionId: string): Promise<ScanResult> {
  const pool = getPool();

  // Load active keywords
  const keywords = await loadKeywords();

  if (keywords.length === 0) {
    return { flagged: false, matchedKeywords: [], severity: 'low' };
  }

  // Load user messages for the session
  const messagesResult = await pool.query(
    `SELECT content FROM session_messages
     WHERE session_id = $1 AND role = 'user'
     ORDER BY created_at ASC`,
    [sessionId],
  );

  if (messagesResult.rows.length === 0) {
    return { flagged: false, matchedKeywords: [], severity: 'low' };
  }

  const matchedKeywords: string[] = [];
  let highestSeverity = 'low';

  // Check each user message against keyword patterns
  for (const msgRow of messagesResult.rows) {
    const content = (msgRow.content ?? '').toLowerCase();

    for (const kw of keywords) {
      const keywordLower = kw.keyword.toLowerCase();

      let matched = false;

      if (kw.isPhrase) {
        // Phrase matching: look for exact phrase in content
        matched = content.includes(keywordLower);
      } else {
        // Single keyword: match at word boundary
        const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        matched = regex.test(content);
      }

      if (matched && !matchedKeywords.includes(kw.keyword)) {
        matchedKeywords.push(kw.keyword);

        if ((SEVERITY_RANK[kw.severity] ?? 0) > (SEVERITY_RANK[highestSeverity] ?? 0)) {
          highestSeverity = kw.severity;
        }
      }
    }
  }

  return {
    flagged: matchedKeywords.length > 0,
    matchedKeywords,
    severity: highestSeverity,
  };
}

/**
 * Run crisis detection on a session and automatically create a flag if keywords match.
 * Marks the session as auto-flagged.
 */
export async function createAutoFlag(
  sessionId: string,
  matchedKeywords: string[],
  severity: string,
): Promise<void> {
  const pool = getPool();

  // Create the flag via riskFlag service (flaggedBy = null for auto-detection)
  await createFlag({
    sessionId,
    flaggedBy: null,
    severity,
    reasonCategory: 'crisis_indicators',
    details: `Auto-detected crisis keywords: ${matchedKeywords.join(', ')}`,
    deanonymizationRequested: false,
    isAutoDetected: true,
    matchedKeywords,
  });

  // Mark session as auto-flagged
  await pool.query(
    'UPDATE sessions SET auto_flagged = true WHERE id = $1',
    [sessionId],
  );
}
