import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { tenantAuth } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { NotFoundError } from '../../utils/errors.js';

const getDbEngine = () => Container.resolve('DatabaseEngine');

const router = express.Router();

/**
 * GET /api/v1/user/me
 * Get current user profile
 */
router.get('/me', tenantAuth, async (req, res, next) => {
  try {
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    const user = await knex('sys_user')
      .where({ id: req.userId, tenant_id: req.tenantId })
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
router.put('/me', tenantAuth, async (req, res, next) => {
  try {
    const { full_name, avatar_url } = req.body;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length > 0) {
      await knex('sys_user')
        .where({ id: req.userId, tenant_id: req.tenantId })
        .update(updateData);
    }

    const updatedUser = await knex('sys_user')
      .where({ id: req.userId, tenant_id: req.tenantId })
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
router.post('/avatar', tenantAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const avatarUrl = `http://localhost:3001/uploads/avatars/${req.file.filename}`;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    await knex('sys_user')
      .where({ id: req.userId, tenant_id: req.tenantId })
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
