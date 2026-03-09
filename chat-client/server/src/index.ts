import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { sendMessageToDialogflow, DialogflowResponse, getAuthMethod } from './dialogflow';
import { initializeDatabase, checkHealth as checkDbHealth, closePool } from './db';
import { getEmailProvider, isEmailConfigured } from './services/email';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import adminSessionsRoutes from './routes/admin.sessions';
import adminTagsRoutes from './routes/admin.tags';
import adminAuditRoutes from './routes/admin.audit';
import adminGroupsRoutes from './routes/admin.groups';
import adminSettingsRoutes from './routes/admin.settings';
import adminApprovalsRoutes from './routes/admin.approvals';
import chatRoutes from './routes/chat';
import groupRoutes from './routes/group';
import settingsRoutes from './routes/settings';

// Load environment variables
dotenv.config();

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
    
    // Allow configured frontend URL (extract origin if full URL provided)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      const allowedOrigin = new URL(frontendUrl).origin;
      if (origin === allowedOrigin) {
        return callback(null, true);
      }
    } catch {
      // If FRONTEND_URL is not a valid URL, compare directly
      if (origin === frontendUrl) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

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
  
  res.json({ 
    status: dbHealthy ? 'ok' : 'degraded', 
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
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

// Auth routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin/users', usersRoutes);
app.use('/api/admin/groups', adminGroupsRoutes);
app.use('/api/admin/approvals', adminApprovalsRoutes);
app.use('/api/admin/sessions', adminSessionsRoutes);
app.use('/api/admin/tags', adminTagsRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);

// Group-scoped routes (group administrators)
app.use('/api/group', groupRoutes);

// Public settings
app.use('/api/settings', settingsRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

// Initialize database and start server
async function startServer() {
  try {
    // Start server first (important for Cloud Run readiness).
    const server = app.listen(PORT, '0.0.0.0', () => {
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

    // Initialize database + maintenance best-effort (do not block startup / readiness).
    if (process.env.DATABASE_URL) {
      void (async () => {
        try {
          // Initialize database (create tables if needed)
          await initializeDatabase();

          // Clean up old messages from ended sessions (maintenance)
          const { cleanupEndedSessionMessages, expireOldSessions } = await import('./services/session.service');
          await cleanupEndedSessionMessages();

          // Best-effort: expire inactive sessions periodically (inactivity timeout).
          // NOTE: In Cloud Run this runs per-instance; for guaranteed cleanup, call
          // POST /api/admin/sessions/expire via Cloud Scheduler.
          await expireOldSessions(30);
          const sessionExpiryInterval = setInterval(() => {
            void expireOldSessions(30).catch((e) => console.warn('[Maintenance] Session expiry failed:', e));
          }, 5 * 60 * 1000);
          // Don't keep the process alive solely because of this timer.
          (sessionExpiryInterval as any).unref?.();
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
