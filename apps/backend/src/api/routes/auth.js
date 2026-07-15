import express from 'express';
import { AuthenticationError } from '../../utils/errors.js';
import AuthEngine from '../../core/AuthEngine/AuthEngine.js';

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * Standard Email/Password Login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await AuthEngine.login(email, password);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh Access Token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const result = await AuthEngine.refresh(refresh_token);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Revoke Refresh Token
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    await AuthEngine.logout(refresh_token);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
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
    await AuthEngine.verifyPin(email, pin);

    res.json({
      success: true,
      message: 'PIN verified successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Note: Google SSO and Change Password endpoints omitted for brevity but should follow the same pattern.
// We can implement them in AuthEngine as needed.

export default router;
