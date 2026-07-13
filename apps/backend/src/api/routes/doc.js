import express from 'express';
import Container from '../../core/Container.js';
import { tenantAuth } from '../middlewares/tenantAuth.js';

const router = express.Router();

/**
 * Middleware to resolve the CRUDEngine for these routes.
 */
const getCrudEngine = () => Container.resolve('CRUDEngine');

// All /doc routes require tenant auth
router.use(tenantAuth);

/**
 * GET /api/v1/doc/:doctype
 * Get a list of documents.
 */
router.get('/:doctype', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const records = await crudEngine.getList(req.params.doctype, req.query, req.tenantId, req.userId);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id
 * Get a single document.
 */
router.get('/:doctype/:id', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.get(req.params.doctype, req.params.id, req.tenantId, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype
 * Create a new document.
 */
router.post('/:doctype', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.insert(req.params.doctype, req.body, req.tenantId, req.userId);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/doc/:doctype/:id
 * Update an existing document.
 */
router.put('/:doctype/:id', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.update(req.params.doctype, req.params.id, req.body, req.tenantId, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/doc/:doctype/:id
 * Soft delete a document.
 */
router.delete('/:doctype/:id', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const result = await crudEngine.delete(req.params.doctype, req.params.id, req.tenantId, req.userId, req.body.delete_reason);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// --- LIFECYCLE ACTION ENDPOINTS ---

/**
 * POST /api/v1/doc/:doctype/:id/submit
 * Submit a document.
 */
router.post('/:doctype/:id/submit', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.submit(req.params.doctype, req.params.id, req.tenantId, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/cancel
 * Cancel a document.
 */
router.post('/:doctype/:id/cancel', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.cancel(req.params.doctype, req.params.id, req.tenantId, req.userId, req.body.cancel_reason);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

export default router;
