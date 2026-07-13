import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Container from '../../core/Container.js';
import { AuthenticationError } from '../../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'framee-super-secret-key';
const JWT_EXPIRES_IN = '24h';

// Helper to get DatabaseEngine
const getDbEngine = () => Container.resolve('DatabaseEngine');

/**
 * POST /api/v1/auth/login
 * Standard Email/Password Login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AuthenticationError('Email and password are required');
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    // We assume tenant is globally unique by email for now, or we'd require tenant context first.
    // Let's just find the first user with this email.
    const userResult = await knex('sys_user').where({ email }).first();
    
    if (!userResult) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (userResult.status !== 'Active') {
      throw new AuthenticationError('User account is not active');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, userResult.password_hash);
    
    if (!isMatch) {
      // In a real app, track failed logins here
      throw new AuthenticationError('Invalid email or password');
    }

    // Update last login
    await knex('sys_user')
      .where({ id: userResult.id })
      .update({ last_login_at: knex.fn.now() });

    // Generate JWT
    const payload = {
      userId: userResult.id,
      tenantId: userResult.tenant_id,
      email: userResult.email
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userResult.id,
          tenantId: userResult.tenant_id,
          email: userResult.email,
          fullName: userResult.full_name,
          avatarUrl: userResult.avatar_url,
          language: userResult.language
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/google
 * Google SSO Login (Mock implementation handling generic profile payloads)
 */
router.post('/google', async (req, res, next) => {
  try {
    const { email, google_id, full_name, avatar_url } = req.body;
    
    if (!email || !google_id) {
      throw new AuthenticationError('Google profile data is incomplete');
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    // 1. Try to find user by google_id
    let userResult = await knex('sys_user').where({ google_id }).first();
    
    // 2. If not found by google_id, try by email
    if (!userResult) {
      userResult = await knex('sys_user').where({ email }).first();
      
      // If found by email, link the google_id
      if (userResult) {
        await knex('sys_user')
          .where({ id: userResult.id })
          .update({ google_id, avatar_url: avatar_url || userResult.avatar_url });
        
        userResult.google_id = google_id;
      }
    }
    
    // 3. If user completely doesn't exist, Auto-Register them in the default tenant
    if (!userResult) {
      const defaultTenantId = '00000000-0000-0000-0000-000000000001';
      const newUserId = uuidv4();
      
      const newUser = {
        id: newUserId,
        tenant_id: defaultTenantId,
        email,
        full_name: full_name || 'Google User',
        google_id,
        avatar_url,
        status: 'Active',
        is_system_user: false,
        language: 'en'
      };
      
      await knex('sys_user').insert(newUser);
      userResult = newUser;
    }

    if (userResult.status !== 'Active') {
      throw new AuthenticationError('User account is not active');
    }

    // Update last login
    await knex('sys_user')
      .where({ id: userResult.id })
      .update({ last_login_at: knex.fn.now() });

    // Generate JWT
    const payload = {
      userId: userResult.id,
      tenantId: userResult.tenant_id,
      email: userResult.email
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userResult.id,
          tenantId: userResult.tenant_id,
          email: userResult.email,
          fullName: userResult.full_name,
          avatarUrl: userResult.avatar_url,
          language: userResult.language
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/verify-pin
 * Verify the user's PIN for unlocking the session
 */
router.post('/verify-pin', async (req, res, next) => {
  try {
    const { email, pin } = req.body;
    
    if (!email || !pin) {
      throw new AuthenticationError('Email and PIN are required');
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    const userResult = await knex('sys_user').where({ email }).first();
    
    if (!userResult || !userResult.pin_hash) {
      throw new AuthenticationError('User or PIN not found');
    }

    const isMatch = await bcrypt.compare(pin, userResult.pin_hash);
    
    if (!isMatch) {
      throw new AuthenticationError('Invalid PIN');
    }

    res.json({
      success: true,
      message: 'PIN verified successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
