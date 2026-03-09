import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getPool } from '../db';

export type ReportType =
  | 'daily_summary'
  | 'weekly_performance'
  | 'monthly_quality'
  | 'escalation_report';

/** Generate a report by type with date range filtering. */
export async function generateReport(
  type: ReportType,
  from: string,
  to: string
): Promise<any> {
  switch (type) {
    case 'daily_summary':
      return generateDailySummary(from, to);
    case 'weekly_performance':
      return generateWeeklyPerformance(from, to);
    case 'monthly_quality':
      return generateMonthlyQuality(from, to);
    case 'escalation_report':
      return generateEscalationReport(from, to);
  }
}

// ── Report generators ──

/**
 * Generate a daily summary report for the given date range.
 * Includes: reviews completed, queue depth, escalation count.
 */
export async function generateDailySummary(from: string, to: string): Promise<any> {
  const pool = getPool();

  // 1. Total reviews completed
  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total_reviews_completed
     FROM session_reviews
     WHERE status = 'completed'
       AND completed_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const totalReviewsCompleted = totalResult.rows[0]?.total_reviews_completed ?? 0;

  // 2. Sessions reviewed (distinct)
  const sessionsResult = await pool.query(
    `SELECT COUNT(DISTINCT session_id)::int AS sessions_reviewed
     FROM session_reviews
     WHERE status = 'completed'
       AND completed_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const sessionsReviewed = sessionsResult.rows[0]?.sessions_reviewed ?? 0;

  // 3. Average score
  const avgResult = await pool.query(
    `SELECT AVG(average_score) AS average_score
     FROM session_reviews
     WHERE status = 'completed'
       AND completed_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const averageScore = avgResult.rows[0]?.average_score != null
    ? Number(Number(avgResult.rows[0].average_score).toFixed(2))
    : null;

  // 4. High-risk flags
  const flagsResult = await pool.query(
    `SELECT COUNT(*)::int AS high_risk_flags
     FROM risk_flags
     WHERE severity = 'high'
       AND created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const highRiskFlags = flagsResult.rows[0]?.high_risk_flags ?? 0;

  // 5. Queue depth (sessions currently pending or in review - snapshot at report time)
  const queueResult = await pool.query(
    `SELECT COUNT(*)::int AS queue_depth
     FROM sessions
     WHERE review_status IN ('pending_review', 'in_review')`,
  );
  const queueDepth = queueResult.rows[0]?.queue_depth ?? 0;

  // 6. Escalation count (total risk flags in period)
  const escalationResult = await pool.query(
    `SELECT COUNT(*)::int AS escalation_count
     FROM risk_flags
     WHERE created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const escalationCount = escalationResult.rows[0]?.escalation_count ?? 0;

  // 7. Criteria feedback breakdown
  const criteriaResult = await pool.query(
    `SELECT cf.criterion, COUNT(*)::int AS cnt
     FROM criteria_feedback cf
     JOIN message_ratings mr ON mr.id = cf.rating_id
     JOIN session_reviews sr ON sr.id = mr.review_id
     WHERE sr.status = 'completed'
       AND sr.completed_at BETWEEN $1 AND $2
     GROUP BY cf.criterion`,
    [from, to],
  );

  const criteriaFeedbackBreakdown: Record<string, number> = {};
  for (const row of criteriaResult.rows) {
    criteriaFeedbackBreakdown[row.criterion] = row.cnt;
  }

  return {
    reportType: 'daily_summary',
    period: { from, to },
    totalReviewsCompleted,
    sessionsReviewed,
    averageScore,
    highRiskFlags,
    queueDepth,
    escalationCount,
    criteriaFeedbackBreakdown,
  };
}

/**
 * Generate a weekly performance report for the given date range.
 */
export async function generateWeeklyPerformance(from: string, to: string): Promise<any> {
  const daily = await generateDailySummary(from, to);
  const pool = getPool();

  // Reviewer breakdown
  const reviewerResult = await pool.query(
    `SELECT
       sr.reviewer_id,
       COALESCE(u.display_name, u.email, sr.reviewer_id) AS display_name,
       COUNT(*)::int AS review_count,
       AVG(sr.average_score) AS avg_score
     FROM session_reviews sr
     LEFT JOIN users u ON u.id = sr.reviewer_id
     WHERE sr.status = 'completed'
       AND sr.completed_at BETWEEN $1 AND $2
     GROUP BY sr.reviewer_id, u.display_name, u.email
     ORDER BY review_count DESC`,
    [from, to],
  );

  const reviewerBreakdown = reviewerResult.rows.map((row: any) => ({
    reviewerId: row.reviewer_id,
    displayName: row.display_name,
    reviewCount: row.review_count,
    averageScore: row.avg_score != null ? Number(Number(row.avg_score).toFixed(2)) : null,
  }));

  // Dispute count
  const disputeResult = await pool.query(
    `SELECT COUNT(*)::int AS dispute_count
     FROM sessions
     WHERE review_status IN ('disputed', 'disputed_closed')
       AND updated_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const disputeCount = disputeResult.rows[0]?.dispute_count ?? 0;

  // Average review time
  const reviewTimeResult = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_seconds
     FROM session_reviews
     WHERE status = 'completed'
       AND completed_at BETWEEN $1 AND $2
       AND started_at IS NOT NULL`,
    [from, to],
  );
  const avgReviewTimeSeconds = reviewTimeResult.rows[0]?.avg_seconds != null
    ? Math.round(Number(reviewTimeResult.rows[0].avg_seconds))
    : null;

  return {
    ...daily,
    reportType: 'weekly_performance',
    reviewerBreakdown,
    disputeCount,
    averageReviewTimeSeconds: avgReviewTimeSeconds,
  };
}

/**
 * Generate a monthly quality report for the given date range.
 */
export async function generateMonthlyQuality(from: string, to: string): Promise<any> {
  const weekly = await generateWeeklyPerformance(from, to);
  const pool = getPool();

  // Score distribution by range
  const distResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE average_score >= 1 AND average_score <= 2)::int AS range_1_2,
       COUNT(*) FILTER (WHERE average_score >= 3 AND average_score <= 4)::int AS range_3_4,
       COUNT(*) FILTER (WHERE average_score >= 5 AND average_score <= 6)::int AS range_5_6,
       COUNT(*) FILTER (WHERE average_score >= 7 AND average_score <= 8)::int AS range_7_8,
       COUNT(*) FILTER (WHERE average_score >= 9 AND average_score <= 10)::int AS range_9_10
     FROM session_reviews
     WHERE status = 'completed'
       AND completed_at BETWEEN $1 AND $2`,
    [from, to],
  );

  const scoreDistribution = {
    '1-2': distResult.rows[0]?.range_1_2 ?? 0,
    '3-4': distResult.rows[0]?.range_3_4 ?? 0,
    '5-6': distResult.rows[0]?.range_5_6 ?? 0,
    '7-8': distResult.rows[0]?.range_7_8 ?? 0,
    '9-10': distResult.rows[0]?.range_9_10 ?? 0,
  };

  // Inter-rater reliability: avg variance across sessions with 2+ reviews
  const irrResult = await pool.query(
    `SELECT AVG(score_variance) AS avg_variance
     FROM (
       SELECT
         session_id,
         VARIANCE(average_score) AS score_variance
       FROM session_reviews
       WHERE status = 'completed'
         AND completed_at BETWEEN $1 AND $2
       GROUP BY session_id
       HAVING COUNT(*) >= 2
     ) sub`,
    [from, to],
  );
  const interRaterReliability = irrResult.rows[0]?.avg_variance != null
    ? Number(Number(irrResult.rows[0].avg_variance).toFixed(3))
    : null;

  // Top flagged criteria
  const topCriteriaResult = await pool.query(
    `SELECT cf.criterion, COUNT(*)::int AS cnt
     FROM criteria_feedback cf
     JOIN message_ratings mr ON mr.id = cf.rating_id
     JOIN session_reviews sr ON sr.id = mr.review_id
     WHERE sr.status = 'completed'
       AND sr.completed_at BETWEEN $1 AND $2
     GROUP BY cf.criterion
     ORDER BY cnt DESC
     LIMIT 10`,
    [from, to],
  );

  const topFlaggedCriteria = topCriteriaResult.rows.map((row: any) => ({
    criterion: row.criterion,
    count: row.cnt,
  }));

  return {
    ...weekly,
    reportType: 'monthly_quality',
    scoreDistribution,
    interRaterReliability,
    topFlaggedCriteria,
  };
}

/**
 * Generate an escalation report for the given date range.
 */
export async function generateEscalationReport(from: string, to: string): Promise<any> {
  const pool = getPool();

  // Total flags
  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total_flags
     FROM risk_flags
     WHERE created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const totalFlags = totalResult.rows[0]?.total_flags ?? 0;

  // By severity
  const severityResult = await pool.query(
    `SELECT severity, COUNT(*)::int AS cnt
     FROM risk_flags
     WHERE created_at BETWEEN $1 AND $2
     GROUP BY severity
     ORDER BY severity`,
    [from, to],
  );
  const bySeverity: Record<string, number> = {};
  for (const row of severityResult.rows) {
    bySeverity[row.severity] = row.cnt;
  }

  // By status
  const statusResult = await pool.query(
    `SELECT status, COUNT(*)::int AS cnt
     FROM risk_flags
     WHERE created_at BETWEEN $1 AND $2
     GROUP BY status
     ORDER BY status`,
    [from, to],
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusResult.rows) {
    byStatus[row.status] = row.cnt;
  }

  // By reason
  const reasonResult = await pool.query(
    `SELECT reason_category, COUNT(*)::int AS cnt
     FROM risk_flags
     WHERE created_at BETWEEN $1 AND $2
     GROUP BY reason_category
     ORDER BY cnt DESC`,
    [from, to],
  );
  const byReason: Record<string, number> = {};
  for (const row of reasonResult.rows) {
    byReason[row.reason_category] = row.cnt;
  }

  // Auto-detected
  const autoResult = await pool.query(
    `SELECT COUNT(*)::int AS auto_detected
     FROM risk_flags
     WHERE is_auto_detected = true
       AND created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const autoDetected = autoResult.rows[0]?.auto_detected ?? 0;

  // Average resolution time (in seconds)
  const resolutionResult = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS avg_seconds
     FROM risk_flags
     WHERE resolved_at IS NOT NULL
       AND created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const averageResolutionTimeSeconds = resolutionResult.rows[0]?.avg_seconds != null
    ? Math.round(Number(resolutionResult.rows[0].avg_seconds))
    : null;

  // SLA compliance
  const slaResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved_total,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_deadline)::int AS resolved_on_time
     FROM risk_flags
     WHERE sla_deadline IS NOT NULL
       AND created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const resolvedTotal = slaResult.rows[0]?.resolved_total ?? 0;
  const resolvedOnTime = slaResult.rows[0]?.resolved_on_time ?? 0;
  const slaCompliance = resolvedTotal > 0
    ? Number(((resolvedOnTime / resolvedTotal) * 100).toFixed(1))
    : null;

  // Deanonymization requests
  const deanonResult = await pool.query(
    `SELECT COUNT(*)::int AS deanonymization_requests
     FROM deanonymization_requests
     WHERE created_at BETWEEN $1 AND $2`,
    [from, to],
  );
  const deanonymizationRequests = deanonResult.rows[0]?.deanonymization_requests ?? 0;

  return {
    reportType: 'escalation_report',
    period: { from, to },
    totalFlags,
    bySeverity,
    byStatus,
    byReason,
    autoDetected,
    averageResolutionTimeSeconds,
    slaCompliance,
    deanonymizationRequests,
  };
}

// ── Export formatters ──

/**
 * Convert report data to CSV string.
 */
export function toCSV(data: any, reportType: string): string {
  const lines: string[] = [];

  lines.push(`Report Type,${reportType}`);
  lines.push(`Generated At,${new Date().toISOString()}`);
  if (data.period) {
    lines.push(`Period From,${data.period.from}`);
    lines.push(`Period To,${data.period.to}`);
  }
  lines.push('');

  // Flatten top-level scalar values
  const scalarKeys = Object.keys(data).filter(
    (k) => typeof data[k] !== 'object' || data[k] === null,
  );
  if (scalarKeys.length > 0) {
    lines.push(scalarKeys.join(','));
    lines.push(scalarKeys.map((k) => data[k] ?? '').join(','));
    lines.push('');
  }

  // Flatten object/array values as sub-tables
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === null || typeof val !== 'object') continue;
    if (key === 'period') continue;

    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`--- ${key} ---`);
      const headers = Object.keys(val[0]);
      lines.push(headers.join(','));
      for (const item of val) {
        lines.push(headers.map((h) => item[h] ?? '').join(','));
      }
      lines.push('');
    } else {
      lines.push(`--- ${key} ---`);
      lines.push('Key,Value');
      for (const [k, v] of Object.entries(val)) {
        lines.push(`${k},${v}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Convert report data to a formatted PDF document.
 */
export async function toPDF(data: any, reportType: string): Promise<Buffer> {
  const lines: string[] = [];
  const divider = '='.repeat(60);
  const subDivider = '-'.repeat(40);

  lines.push(divider);
  lines.push(`  REPORT: ${reportType.replace(/_/g, ' ').toUpperCase()}`);
  lines.push(`  Generated: ${new Date().toISOString()}`);
  if (data.period) {
    lines.push(`  Period: ${data.period.from} — ${data.period.to}`);
  }
  lines.push(divider);
  lines.push('');

  // Scalar values
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === null || val === undefined) {
      lines.push(`  ${formatLabel(key)}: N/A`);
    } else if (typeof val !== 'object') {
      lines.push(`  ${formatLabel(key)}: ${val}`);
    }
  }
  lines.push('');

  // Object/array values
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === null || typeof val !== 'object') continue;
    if (key === 'period') continue;

    lines.push(subDivider);
    lines.push(`  ${formatLabel(key)}`);
    lines.push(subDivider);

    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push('  (no data)');
      } else {
        for (const item of val) {
          const parts = Object.entries(item)
            .map(([k, v]) => `${formatLabel(k)}: ${v}`)
            .join(' | ');
          lines.push(`  ${parts}`);
        }
      }
    } else {
      for (const [k, v] of Object.entries(val)) {
        lines.push(`  ${formatLabel(k)}: ${v}`);
      }
    }
    lines.push('');
  }

  lines.push(divider);
  lines.push('  END OF REPORT');
  lines.push(divider);

  const textContent = lines.join('\n');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentWidth = pageWidth - 2 * margin;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const textLines = textContent.split('\n');
  for (const line of textLines) {
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: contentWidth,
    });
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Format a camelCase/snake_case key into a human-readable label.
 */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
