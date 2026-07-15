import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Provide absolute path so it works regardless of where the app is started
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  app: {
    env: process.env.APP_ENV || 'development',
    port: parseInt(process.env.APP_PORT || '3001', 10),
    systemTenantId: process.env.SYSTEM_TENANT_ID || '2607-00001',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'framee_dev',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'secret_for_development_only',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '3600',
  }
};
