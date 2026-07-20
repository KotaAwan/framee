import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { AuthenticationError } from '../../utils/errors.js';
import DatabaseEngine from '../DatabaseEngine/DatabaseEngine.js';
import CacheEngine from '../CacheEngine/CacheEngine.js';
import EventEngine from '../EventEngine/EventEngine.js';

const JWT_SECRET = process.env.JWT_SECRET || 'framee-super-secret-key';
const rawExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
const JWT_EXPIRES_IN = isNaN(rawExpiresIn) ? rawExpiresIn : Number(rawExpiresIn);
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MINUTES = 30;

class AuthEngine {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    logger.info('Initializing Auth Engine...');
    this.isInitialized = true;
  }

  /**
   * Authenticate a user with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} { token, refresh_token, user }
   */
  async login(email, password) {
    if (!email || !password) {
      throw new AuthenticationError('Email and password are required');
    }

    const knex = DatabaseEngine.getRawConnection();
    
    // Find user by email
    const user = await knex('sys_user').where({ email }).first();
    
    if (!user) {
      // Prevent timing attacks by hashing something anyway (optional, but good practice)
      await bcrypt.compare(password, '$2a$12$KIXe8Ppx7yC6w8Ppx7yC6eKIXe8Ppx7yC6w8Ppx7yC6eKIXe8Ppx7');
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const waitMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AuthenticationError(`Account is temporarily locked. Try again in ${waitMinutes} minutes.`);
    } else if (user.locked_until && new Date() >= new Date(user.locked_until)) {
      // Lock expired, reset
      await knex('sys_user').where({ id: user.id }).update({ failed_login_count: 0, locked_until: null });
    }

    if (user.is_deleted || (user.status !== 'Saved' && user.status !== 'New' && user.status !== 'Draft')) {
      throw new AuthenticationError(`User account is not active`);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      const failCount = (user.failed_login_count || 0) + 1;
      const updateData = { failed_login_count: failCount };
      
      if (failCount >= MAX_FAILED_LOGINS) {
        updateData.locked_until = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000);
        EventEngine.emit('user.locked', { userId: user.id, email: user.email });
      }
      
      await knex('sys_user').where({ id: user.id }).update(updateData);
      EventEngine.emit('user.login_failed', { email, failCount });
      
      throw new AuthenticationError('Invalid email or password');
    }

    // Success login
    const sessionId = uuidv4();
    await knex('sys_user').where({ id: user.id }).update({ 
      last_login_at: knex.fn.now(),
      failed_login_count: 0,
      locked_until: null
    });

    const tokens = await this._generateTokens(user, sessionId);
    
    // Emit login event
    EventEngine.emit('user.login', { userId: user.id, email: user.email }, { tenant_id: user.tenant_id, user_id: user.id });

    // Load roles
    const userRoles = await knex('sys_user_role')
      .join('sys_role', 'sys_user_role.role_id', 'sys_role.id')
      .where('sys_user_role.user_id', user.id)
      .select('sys_role.name');
    
    const roleNames = userRoles.map(r => r.name);

    return {
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
        fullName: user.name, // Keep fullName for backwards compatibility in UI
        roles: roleNames,
        avatarUrl: user.avatar_url,
        language: user.language,
        timezone: user.timezone,
        is_system_user: user.is_system_user === 1 || user.is_system_user === true
      }
    };
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * @param {string} refreshToken 
   */
  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required');
    }

    const tokenHash = this._hashToken(refreshToken);
    const cacheKey = `framee:refresh:${tokenHash}`;
    
    const sessionData = await CacheEngine.get(cacheKey);
    if (!sessionData) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Invalidate the old refresh token (rotate)
    await CacheEngine.del(cacheKey);

    const knex = DatabaseEngine.getRawConnection();
    const user = await knex('sys_user').where({ id: sessionData.userId }).first();
    
    if (!user || user.status !== 'Active') {
      throw new AuthenticationError('User account is not active');
    }

    const tokens = await this._generateTokens(user, sessionData.sessionId);

    return {
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    };
  }

  /**
   * Logs out a user by invalidating their refresh token.
   * @param {string} refreshToken 
   */
  async logout(refreshToken) {
    if (refreshToken) {
      const tokenHash = this._hashToken(refreshToken);
      const cacheKey = `framee:refresh:${tokenHash}`;
      
      const sessionData = await CacheEngine.get(cacheKey);
      if (sessionData) {
        await CacheEngine.del(cacheKey);
        EventEngine.emit('user.logout', { userId: sessionData.userId });
      }
    }
  }

  /**
   * Verify session unlock PIN
   * @param {string} email 
   * @param {string} pin 
   */
  async loginWithPin(email, pin) {
    if (!email || !pin) throw new ValidationError('Email and PIN are required');
    
    const knex = DatabaseEngine.getRawConnection();
    const user = await knex('sys_user').where({ email }).first();
    if (!user || user.is_deleted || (user.status !== 'Saved' && user.status !== 'New' && user.status !== 'Draft' && user.status !== 'Submitted' && user.status !== 'Active')) {
      throw new AuthenticationError('Invalid email or PIN');
    }

    const isMatch = await bcrypt.compare(pin, user.pin_hash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid PIN');
    }

    return true;
  }

  // --- Private Helpers ---

  async _generateTokens(user, sessionId) {
    // 1. Access Token
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      sessionId
    };
    
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // 2. Refresh Token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this._hashToken(refreshToken);
    
    // 3. Store in Redis
    await CacheEngine.set(`framee:refresh:${tokenHash}`, {
      userId: user.id,
      tenantId: user.tenant_id,
      sessionId
    }, REFRESH_TTL_SEC);

    return { accessToken, refreshToken };
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

const instance = new AuthEngine();
export default instance;
