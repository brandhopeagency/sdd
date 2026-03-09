import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewReports,
} from '../middleware/reviewAuth';
import {
  generateReport,
  toCSV,
  toPDF,
} from '../services/reviewReport.service';

const router = Router();
router.use(...reviewAuth);

const VALID_TYPES = [
  'daily_summary',
  'weekly_performance',
  'monthly_quality',
  'escalation_report',
] as const;

type ReportType = (typeof VALID_TYPES)[number];

const VALID_FORMATS = ['json', 'csv', 'pdf'] as const;

/**
 * GET /
 * List available report types (REVIEW_REPORTS permission).
 * Full path: /api/review/reports
 */
router.get(
  '/',
  requireReviewReports,
  async (_req: Request, res: Response) => {
    return res.json({
      success: true,
      data: {
        reportTypes: VALID_TYPES,
        formats: VALID_FORMATS,
      },
    });
  },
);

/**
 * GET /generate | POST /generate
 * Generate a report for the specified type and date range.
 * Full path: /api/review/reports/generate
 *
 * Query params (GET) or body (POST):
 *   type   - one of daily_summary | weekly_performance | monthly_quality | escalation_report
 *   from   - ISO date string (start of range)
 *   to     - ISO date string (end of range)
 *   format - json | csv | pdf  (default: json)
 */
async function handleGenerate(req: Request, res: Response) {
  const params = req.method === 'POST' ? req.body : req.query;
  const { type, from, to, format = 'json' } = params as {
    type?: string;
    from?: string;
    to?: string;
    format?: string;
  };

  try {
    // Validate report type
    if (!type || !VALID_TYPES.includes(type as ReportType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REPORT_TYPE',
          message: `Invalid report type. Must be one of: ${VALID_TYPES.join(', ')}`,
        },
      });
    }

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATE_RANGE',
          message: 'Both "from" and "to" parameters are required',
        },
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE',
          message: '"from" and "to" must be valid ISO date strings',
        },
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: '"from" must be before or equal to "to"',
        },
      });
    }

    // Validate format
    if (!VALID_FORMATS.includes(format as any)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`,
        },
      });
    }

    // Generate report
    const report = await generateReport(type as ReportType, from, to);

    // Return in requested format
    if (format === 'csv') {
      const csv = toCSV(report, type);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${type}_${from}_${to}.csv"`,
      );
      return res.send(csv);
    }

    if (format === 'pdf') {
      const pdf = await toPDF(report, type);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${type}_${from}_${to}.pdf"`,
      );
      return res.send(pdf);
    }

    // Default: JSON
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('[Review Reports] Error generating report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate report',
      },
    });
  }
}

router.get('/generate', requireReviewReports, handleGenerate);
router.post('/generate', requireReviewReports, handleGenerate);

export default router;
