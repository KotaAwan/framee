import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import Container from './core/Container.js';
import { errorHandler } from './api/middlewares/errorHandler.js';

// Core Engines
import DatabaseEngine from './core/DatabaseEngine/DatabaseEngine.js';
import CacheEngine from './core/CacheEngine/CacheEngine.js';
import MetadataEngine from './core/MetadataEngine/MetadataEngine.js';
import PermissionEngine from './core/PermissionEngine/PermissionEngine.js';
import LifecycleEngine from './core/LifecycleEngine/LifecycleEngine.js';
import SchemaEngine from './core/SchemaEngine/SchemaEngine.js';
import CRUDEngine from './core/CRUDEngine/CRUDEngine.js';
import EventEngine from './core/EventEngine/EventEngine.js';
import AuthEngine from './core/AuthEngine/AuthEngine.js';
import AuditEngine from './core/AuditEngine/AuditEngine.js';
import VersionEngine from './core/VersionEngine/VersionEngine.js';
import WorkflowEngine from './core/WorkflowEngine/WorkflowEngine.js';
import QueueEngine from './core/QueueEngine/QueueEngine.js';
import NamingEngine from './core/NamingEngine/NamingEngine.js';
import PrintEngine from './core/PrintEngine/PrintEngine.js';
import DataEngine from './core/DataEngine/DataEngine.js';

// Routes
import docRoutes from './api/routes/doc.js';
import authRoutes from './api/routes/auth.js';
import userRoutes from './api/routes/user.js';
import auditRoutes from './api/routes/audit.js';
import metaRoutes from './api/routes/meta.js';
import workspaceRoutes from './api/routes/workspace.js';

export async function createServer() {
  const app = express();

  // Basic Middlewares
  app.use(cors());
  app.use(express.json());

  // Static files for uploads
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Initialize Engines
  await DatabaseEngine.init();
  await CacheEngine.init();
  await EventEngine.init();
  await AuthEngine.init();
  await AuditEngine.init();
  await VersionEngine.init();

  // Register Engines to Container
  Container.register('DatabaseEngine', DatabaseEngine);
  Container.register('CacheEngine', CacheEngine);
  Container.register('EventEngine', EventEngine);
  Container.register('AuthEngine', AuthEngine);
  Container.register('AuditEngine', AuditEngine);
  Container.register('VersionEngine', VersionEngine);
  Container.register('MetadataEngine', MetadataEngine);
  Container.register('PermissionEngine', PermissionEngine);
  Container.register('LifecycleEngine', LifecycleEngine);
  Container.register('SchemaEngine', SchemaEngine);
  Container.register('CRUDEngine', CRUDEngine);
  Container.register('WorkflowEngine', WorkflowEngine);
  Container.register('QueueEngine', QueueEngine);
  Container.register('NamingEngine', NamingEngine);
  Container.register('PrintEngine', PrintEngine);
  Container.register('DataEngine', DataEngine);

  // Initialize dependent engines
  MetadataEngine.init();
  PermissionEngine.init();
  LifecycleEngine.init();
  SchemaEngine.init();
  NamingEngine.init();
  PrintEngine.init();
  DataEngine.init();
  CRUDEngine.init();
  WorkflowEngine.init();
  await QueueEngine.init();

  // Initialize Listeners
  const { initializeTranslationListener } = await import('./listeners/translation.listener.js');
  initializeTranslationListener();

  // API Routes
  app.get('/health', (req, res) => res.json({ status: 'OK' }));
  app.use('/api/v1/doc', docRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/meta', metaRoutes);
  app.use('/api/v1/workspace', workspaceRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

// Start the server if this file is run directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  createServer()
    .then((app) => {
      const port = config.app.port;
      app.listen(port, () => {
        logger.info(`🚀 Framee API Server running on port ${port} in ${config.app.env} mode.`);
      });
    })
    .catch((err) => {
      logger.error('Failed to start server:', err);
      process.exit(1);
    });
}
