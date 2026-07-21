import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { NotFoundError } from '../../utils/errors.js';

const getDbEngine = () => Container.resolve('DatabaseEngine');
const getEventEngine = () => Container.resolve('EventEngine');

const router = express.Router();

/**
 * GET /api/v1/user/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    const user = await knex('sys_user')
      .where({ id: req.userId })
      .first();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Omit sensitive fields
    const { password_hash, pin_hash, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/user/me
 * Update current user profile (full_name and avatar_url)
 */
router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const { name, full_name, phone, language_id, timezone, date_format, avatar_url } = req.body;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    // Keep full_name fallback if client still sends it
    if (full_name !== undefined) updateData.name = full_name; 
    if (phone !== undefined) updateData.phone = phone;
    if (language_id !== undefined) updateData.language_id = language_id;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (date_format !== undefined) updateData.date_format = date_format;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length > 0) {
      await knex('sys_user')
        .where({ id: req.userId })
        .update(updateData);
    }

    const updatedUser = await knex('sys_user')
      .where({ id: req.userId })
      .first();

    const { password_hash, pin_hash, ...safeUser } = updatedUser;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/user/change-password
 * Change user password
 */
router.put('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      throw new Error('Current password and new password are required');
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    const user = await knex('sys_user').where({ id: req.userId }).first();
    if (!user) throw new NotFoundError('User not found');

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      throw new Error('Incorrect current password');
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await knex('sys_user').where({ id: req.userId }).update({
      password_hash: newHash
    });

    const eventEngine = getEventEngine();
    eventEngine.emit('sys_user.updated', { 
      doc: { id: user.id, email: user.email, status: user.status }, 
      action: 'Change Password' 
    }, { user_id: req.userId, doc_id: user.id, doctype: 'sys_user' });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    // Send standard error message to avoid 500 html on client
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/v1/user/change-pin
 * Change user PIN
 */
router.put('/change-pin', authMiddleware, async (req, res, next) => {
  try {
    const { current_password, new_pin } = req.body;
    if (!current_password || !new_pin) {
      throw new Error('Current password and new PIN are required');
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    const user = await knex('sys_user').where({ id: req.userId }).first();
    if (!user) throw new NotFoundError('User not found');

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      throw new Error('Incorrect current password');
    }

    const newHash = await bcrypt.hash(new_pin, 10);
    await knex('sys_user').where({ id: req.userId }).update({
      pin_hash: newHash
    });

    const eventEngine = getEventEngine();
    eventEngine.emit('sys_user.updated', { 
      doc: { id: user.id, email: user.email, status: user.status }, 
      action: 'Change PIN' 
    }, { user_id: req.userId, doc_id: user.id, doctype: 'sys_user' });

    res.json({
      success: true,
      message: 'PIN updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Configure Multer for Avatar Uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../../../uploads/avatars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

/**
 * POST /api/v1/user/avatar
 * Upload a new avatar image
 */
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const avatarUrl = `http://localhost:3001/uploads/avatars/${req.file.filename}`;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    await knex('sys_user')
      .where({ id: req.userId })
      .update({ avatar_url: avatarUrl });

    res.json({
      success: true,
      data: { avatarUrl }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
