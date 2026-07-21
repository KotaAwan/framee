import { AuthenticationError } from '../../utils/errors.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

/**
 * Middleware to authenticate requests using JWT.
 * Extracts user info from the token. Multi-tenancy is not used.
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.userId = decoded.userId;
    req.email = decoded.email;

    next();
  } catch (error) {
    next(new AuthenticationError('Invalid or expired token'));
  }
};
