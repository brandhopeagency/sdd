import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { sendMessageToDialogflow, DialogflowResponse, getAuthMethod } from './dialogflow';
import { initializeDatabase, checkHealth as checkDbHealth, closePool } from './db';
import { getEmailProvider, isEmailConfigured } from './services/email';
import * as redisService from './services/redis.service';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import adminSessionsRoutes from './routes/admin.sessions';
import adminTagsRoutes from './routes/admin.tags';
import adminUserTagsRouter from './routes/admin.userTags';
import adminAuditRoutes from './routes/admin.audit';
import adminGroupsRoutes from './routes/admin.groups';
import adminSettingsRoutes from './routes/admin.settings';
import adminApprovalsRoutes from './routes/admin.approvals';
import chatRoutes from './routes/chat';
import groupRoutes from './routes/group';
import settingsRoutes from './routes/settings';

// Review system routes
import reviewQueueRouter from './routes/review.queue';
import reviewSessionsRouter from './routes/review.sessions';
import reviewFlagsRouter from './routes/review.flags';
import reviewDeanonymizationRouter from './routes/review.deanonymization';
import reviewDashboardRouter from './routes/review.dashboard';
import reviewNotificationsRouter from './routes/review.notifications';
import reviewReportsRouter from './routes/review.reports';
import reviewSessionTagsRouter from './routes/review.sessionTags';
import reviewSupervisionRouter from './routes/review.supervision';
import reviewGradeDescriptionsRouter from './routes/review.gradeDescriptions';
import adminReviewConfigRouter from './routes/admin.reviewConfig';
import surveySchemaRouter from './routes/survey.schemas';
import surveyInstanceRouter from './routes/survey.instances';
import surveyResponseRouter from './routes/survey.responses';
import surveyGateRouter from './routes/survey.gate';
import surveyGroupsRouter from './routes/survey.groups';
import { workbenchGuard } from './middleware/workbenchGuard';
import { authenticate, requireActiveAccount } from './middleware/auth';

// Load environment variables
dotenv.config();

// ── Service surface configuration ──
// Controls which routes are mounted in this instance.
// undefined/empty = mount everything (backward compatible, single-service mode)
// 'chat'      = chat-facing routes only
// 'workbench' = workbench/admin routes only
const VALID_SURFACES = ['chat', 'workbench'] as const;
const rawSurface = (process.env.SERVICE_SURFACE || '').trim().toLowerCase();
const SERVICE_SURFACE: string | undefined = rawSurface || undefined;

if (SERVICE_SURFACE && !(VALID_SURFACES as readonly string[]).includes(SERVICE_SURFACE)) {
  console.error(`[FATAL] Invalid SERVICE_SURFACE="${process.env.SERVICE_SURFACE}". Must be one of: ${VALID_SURFACES.join(', ')}`);
  process.exit(1);
}

const app = express();
// Cloud Run provides PORT; default to 8080 for parity with container runtime.
const PORT = Number(process.env.PORT) || 8080;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    
    // Allow Google Cloud Storage origins (for GCS-hosted frontends)
    if (origin === 'https://storage.googleapis.com') {
      return callback(null, true);
    }
    
    // Allow configured frontend URLs (chat + workbench surfaces)
    const allowedEnvUrls = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      process.env.WORKBENCH_FRONTEND_URL,
    ].filter(Boolean) as string[];

    for (const envUrl of allowedEnvUrls) {
      try {
        const allowedOrigin = new URL(envUrl).origin;
        if (origin === allowedOrigin) {
          return callback(null, true);
        }
      } catch {
        // If the env var is not a valid URL, compare directly
        if (origin === envUrl) {
          return callback(null, true);
        }
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API version header for contract compatibility checking
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
  res.setHeader('X-Service-Surface', SERVICE_SURFACE || 'all');
  next();
});

app.get('/', (_req, res) => {
  res.json({ service: 'chat-backend', status: 'ok' });
});

app.get('/healthz', async (_req, res) => {
  let dbHealthy = false;
  try {
    dbHealthy = await checkDbHealth();
  } catch {
    dbHealthy = false;
  }
  const redisOk = redisService.isHealthy();
  const allHealthy = dbHealthy && redisOk;
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy,
      redis: redisOk,
    },
  });
});

app.get('/robots.txt', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send('User-agent: *\nDisallow: /api/\n');
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const authMethod = getAuthMethod();
  const isCloudRun = !!process.env.K_SERVICE;
  
  // Check database health
  let dbHealthy = false;
  try {
    dbHealthy = await checkDbHealth();
  } catch {
    dbHealthy = false;
  }

  // Check email configuration
  let emailConfigured = false;
  try {
    emailConfigured = await isEmailConfigured();
  } catch {
    emailConfigured = false;
  }

  const redisStatus = redisService.getStatus();
  const allHealthy = dbHealthy && redisService.isHealthy();
  
  res.json({ 
    status: allHealthy ? 'ok' : 'degraded', 
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisStatus,
      email: {
        provider: getEmailProvider().name,
        configured: emailConfigured
      }
    },
    dialogflow: {
      projectId: process.env.DIALOGFLOW_PROJECT_ID ? 'configured' : 'missing',
      location: process.env.DIALOGFLOW_LOCATION || 'global',
      agentId: process.env.DIALOGFLOW_AGENT_ID ? 'configured' : 'missing',
      authMethod: authMethod,
      environment: isCloudRun ? 'cloud_run' : 'local',
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'service_account_file' : (isCloudRun ? 'metadata_server' : 'none')
    }
  });
});

// ── Surface-aware route mounting ──
// Auth and settings are shared across all surfaces.
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);

const mountChat = !SERVICE_SURFACE || SERVICE_SURFACE === 'chat';
const mountWorkbench = !SERVICE_SURFACE || SERVICE_SURFACE === 'workbench';

if (mountChat) {
  // Chat routes
  app.use('/api/chat', chatRoutes);
  // Survey gate routes (user-facing)
  app.use('/api/chat', surveyGateRouter);
}

if (mountWorkbench) {
  // Workbench guard — authenticate first, then check WORKBENCH_ACCESS permission.
  // Each router also has its own authenticate middleware, but running it at the
  // app level first ensures workbenchGuard always sees req.user.
  app.use('/api/admin', authenticate, requireActiveAccount, workbenchGuard);
  app.use('/api/group', authenticate, requireActiveAccount, workbenchGuard);
  app.use('/api/review', authenticate, requireActiveAccount, workbenchGuard);

  // Admin routes
  app.use('/api/admin/users', usersRoutes);
  app.use('/api/admin/groups', adminGroupsRoutes);
  app.use('/api/admin/approvals', adminApprovalsRoutes);
  app.use('/api/admin/sessions', adminSessionsRoutes);
  app.use('/api/admin/tags', adminTagsRoutes);
  app.use('/api/admin/users', adminUserTagsRouter);
  app.use('/api/admin/audit', adminAuditRoutes);
  app.use('/api/admin/settings', adminSettingsRoutes);
  app.use('/api/admin/review', adminReviewConfigRouter);

  // Group-scoped routes (group administrators)
  app.use('/api/group', groupRoutes);

  // Review system routes
  app.use('/api/review', reviewQueueRouter);
  app.use('/api/review/sessions', reviewSessionsRouter);
  app.use('/api/review/sessions', reviewFlagsRouter);
  app.use('/api/review/sessions', reviewSessionTagsRouter);
  app.use('/api/review/deanonymization', reviewDeanonymizationRouter);
  app.use('/api/review/dashboard', reviewDashboardRouter);
  app.use('/api/review/notifications', reviewNotificationsRouter);
  app.use('/api/review/reports', reviewReportsRouter);
  app.use('/api/review/supervision', reviewSupervisionRouter);
  app.use('/api/review/grade-descriptions', reviewGradeDescriptionsRouter);

  // Survey workbench routes
  app.use('/api/workbench/survey-schemas', surveySchemaRouter);
  app.use('/api/workbench/survey-instances', surveyInstanceRouter);
  app.use('/api/workbench/survey-responses', surveyResponseRouter);
  app.use('/api/workbench/groups/:groupId/surveys', surveyGroupsRouter);
}

import { startNotificationRetryPolling } from './services/reviewNotification.service';

// Initialize database and start server
async function startServer() {
  try {
    // Start server first (important for Cloud Run readiness).
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Surface] SERVICE_SURFACE=${SERVICE_SURFACE || '(all)'} — routes: auth, settings${mountChat ? ', chat' : ''}${mountWorkbench ? ', admin/*, group/*, review/*' : ''}`);
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Chat Application Backend Server                   ║
╠════════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                       ║
║  Health check: http://localhost:${PORT}/api/health                ║
║  Chat endpoint: POST http://localhost:${PORT}/api/chat/message    ║
║  Auth endpoints: /api/auth/*                                   ║
║  Admin endpoints: /api/admin/*                                 ║
╚════════════════════════════════════════════════════════════════╝
    `);
      
      // Log configuration status
      const projectId = process.env.DIALOGFLOW_PROJECT_ID;
      const agentId = process.env.DIALOGFLOW_AGENT_ID;
      const location = process.env.DIALOGFLOW_LOCATION || 'global';
      const authMethod = getAuthMethod();
      
      // Database status
      if (process.env.DATABASE_URL) {
        console.log('✓ Database configured');
      } else {
        console.warn('⚠️  Database not configured (DATABASE_URL missing)');
      }

      // Email provider status
      const emailProvider = getEmailProvider();
      console.log(`✓ Email provider: ${emailProvider.name}`);
      
      if (!projectId || !agentId) {
        console.warn('⚠️  Warning: Dialogflow configuration incomplete!');
        console.warn('   Set DIALOGFLOW_PROJECT_ID, DIALOGFLOW_AGENT_ID in .env');
        console.warn('   Using mock responses until configured.');
      } else {
        console.log(`✓ Dialogflow CX configured:`);
        console.log(`  Project: ${projectId}`);
        console.log(`  Location: ${location}`);
        console.log(`  Agent: ${agentId}`);
        
        // Show auth method
        if (authMethod === 'service_account') {
          console.log(`  Auth: Service Account ✓`);
        } else {
          console.warn('  Auth: Mock responses (no credentials)');
          console.warn('  → Add GOOGLE_APPLICATION_CREDENTIALS to use Dialogflow');
        }
      }
    });

    // Initialize Redis (best-effort — do not block startup).
    void (async () => {
      try {
        await redisService.connect();
      } catch (e) {
        console.error('[Startup] Redis connection failed (continuing):', e);
      }
    })();

    // Initialize database + maintenance best-effort (do not block startup / readiness).
    if (process.env.DATABASE_URL) {
      void (async () => {
        try {
          // Initialize database (create tables if needed)
          await initializeDatabase();

          // Clean up old messages from ended sessions (maintenance)
          const { cleanupEndedSessionMessages, expireOldSessions } = await import('./services/session.service');
          await cleanupEndedSessionMessages();

          // FR-026: Start notification retry polling (pending risk flags + assignment expiry reminders)
          startNotificationRetryPolling();

          // Best-effort: expire inactive sessions periodically (inactivity timeout).
          // NOTE: In Cloud Run this runs per-instance; for guaranteed cleanup, call
          // POST /api/admin/sessions/expire via Cloud Scheduler.
          await expireOldSessions(30);
          const sessionExpiryInterval = setInterval(() => {
            void expireOldSessions(30).catch((e) => console.warn('[Maintenance] Session expiry failed:', e));
          }, 5 * 60 * 1000);
          // Don't keep the process alive solely because of this timer.
          (sessionExpiryInterval as any).unref?.();

          // Survey instance status transitions (draft→active, active→expired)
          const { startSurveyStatusJob } = await import('./jobs/surveyStatusJob');
          startSurveyStatusJob();
        } catch (e) {
          console.error('[Startup] Database initialization/maintenance failed (continuing):', e);
        }
      })();
    } else {
      console.warn('⚠️  DATABASE_URL not set - running without database');
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down gracefully...');
      server.close(async () => {
        await redisService.disconnect();
        await closePool();
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
