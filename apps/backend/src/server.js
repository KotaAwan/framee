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
import CRUDEngine from './core/CRUDEngine/CRUDEngine.js';

// Routes
import docRoutes from './api/routes/doc.js';
import authRoutes from './api/routes/auth.js';
import userRoutes from './api/routes/user.js';

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

  // Register Engines to Container
  Container.register('DatabaseEngine', DatabaseEngine);
  Container.register('CacheEngine', CacheEngine);
  Container.register('MetadataEngine', MetadataEngine);
  Container.register('PermissionEngine', PermissionEngine);
  Container.register('LifecycleEngine', LifecycleEngine);
  Container.register('CRUDEngine', CRUDEngine);

  // Initialize dependent engines
  MetadataEngine.init();
  PermissionEngine.init();
  LifecycleEngine.init();
  CRUDEngine.init();

  // API Routes
  app.get('/health', (req, res) => res.json({ status: 'OK' }));
  app.use('/api/v1/doc', docRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);

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
