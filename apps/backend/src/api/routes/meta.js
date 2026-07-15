import express from 'express';
import Container from '../../core/Container.js';
import { tenantAuth } from '../middlewares/tenantAuth.js';

const router = express.Router();

const getMetadataEngine = () => Container.resolve('MetadataEngine');

// All /meta routes require tenant auth
router.use(tenantAuth);

/**
 * GET /api/v1/meta/doctype/:doctype
 * Get DocType metadata including fields.
 */
router.get('/doctype/:doctype', async (req, res, next) => {
  try {
    const metaEngine = getMetadataEngine();
    const meta = await metaEngine.getDocType(req.params.doctype, req.tenantId);
    res.json({ success: true, data: meta });
  } catch (error) {
    next(error);
  }
});

export default router;
