import express from 'express';
import Container from '../../core/Container.js';
import { authMiddleware } from '../middlewares/tenantAuth.js';

const router = express.Router();

const getMetadataEngine = () => Container.resolve('MetadataEngine');
const getDbEngine = () => Container.resolve('DatabaseEngine');

// All /meta routes require auth
router.use(authMiddleware);

/**
 * GET /api/v1/meta/doctype/:doctype
 * Get DocType metadata including fields.
 */
router.get('/doctype/:doctype', async (req, res, next) => {
  try {
    const metaEngine = getMetadataEngine();
    const meta = await metaEngine.getDocType(req.params.doctype);
    res.json({ success: true, data: meta });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/meta/doctype/:doctype/fields-visibility
 * Bulk update sys_docfield `in_list` flag.
 */
router.put('/doctype/:doctype/fields-visibility', async (req, res, next) => {
  try {
    const { doctype } = req.params;
    const { visibility } = req.body; // Object: { fieldname: boolean }

    if (!visibility || typeof visibility !== 'object') {
      return res.status(400).json({ success: false, message: 'visibility object is required' });
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    // Begin Transaction to bulk update
    await knex.transaction(async (trx) => {
      for (const [fieldname, visible] of Object.entries(visibility)) {
        if (fieldname === 'id') continue; // ID is system, not stored as in_list in sys_docfield
        await trx('sys_docfield')
          .where({ doctype, fieldname })
          .update({ in_list: visible ? 1 : 0 });
      }
    });

    // Invalidate Cache
    const metaEngine = getMetadataEngine();
    await metaEngine.invalidate(doctype);

    res.json({ success: true, message: 'Fields visibility updated and saved successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/meta/doctype/:doctype/fields-filter-config
 * Bulk update sys_docfield `in_filter` flag.
 */
router.put('/doctype/:doctype/fields-filter-config', async (req, res, next) => {
  try {
    const { doctype } = req.params;
    const { filters } = req.body; // Object: { fieldname: boolean }

    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ success: false, message: 'filters object is required' });
    }

    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();

    // Begin Transaction to bulk update
    await knex.transaction(async (trx) => {
      for (const [fieldname, active] of Object.entries(filters)) {
        await trx('sys_docfield')
          .where({ doctype, fieldname })
          .update({ in_filter: active ? 1 : 0 });
      }
    });

    // Invalidate Cache
    const metaEngine = getMetadataEngine();
    await metaEngine.invalidate(doctype);

    res.json({ success: true, message: 'Fields filter configuration updated successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
