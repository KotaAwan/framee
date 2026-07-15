import express from 'express';
import multer from 'multer';
import Container from '../../core/Container.js';
import { tenantAuth } from '../middlewares/tenantAuth.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

/**
 * Middleware to resolve the CRUDEngine for these routes.
 */
const getCrudEngine = () => Container.resolve('CRUDEngine');

// All /doc routes require tenant auth
router.use(tenantAuth);

/**
 * Helper to remove sensitive fields from a document before sending to the client.
 */
const sanitizeDoc = (doc) => {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(sanitizeDoc);
  const sensitiveFields = ['password', 'password_hash', 'pin', 'pin_hash', 'google_id'];
  const sanitized = { ...doc };
  sensitiveFields.forEach(f => delete sanitized[f]);
  // Also sanitize children if any (arrays of objects)
  for (const key in sanitized) {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(child => {
        if (typeof child === 'object' && child !== null) {
          const sChild = { ...child };
          sensitiveFields.forEach(f => delete sChild[f]);
          return sChild;
        }
        return child;
      });
    }
  }
  return sanitized;
};

/**
 * GET /api/v1/doc/:doctype
 * Get a list of documents.
 */
router.get('/:doctype', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const records = await crudEngine.getList(req.params.doctype, req.query, req.tenantId, req.userId);
    res.json({ success: true, data: sanitizeDoc(records) });
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
    res.json({ success: true, data: sanitizeDoc(record) });
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
    res.status(201).json({ success: true, data: sanitizeDoc(record) });
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
    res.json({ success: true, data: sanitizeDoc(record) });
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

// --- SOCIAL ACTION ENDPOINTS ---
import EventEngine from '../../core/EventEngine/EventEngine.js';

/**
 * POST /api/v1/doc/:doctype/:id/comment
 * Add a comment.
 */
router.post('/:doctype/:id/comment', async (req, res, next) => {
  try {
    const { doctype, id } = req.params;
    const { comment } = req.body;
    
    if (!comment) return res.status(400).json({ success: false, message: 'Comment is required' });

    EventEngine.emit(`${doctype}.comment`, 
      { doctype, doc_id: id, comment },
      { tenant_id: req.tenantId, user_id: req.userId, user_name: req.user?.full_name || 'System' }
    );
    
    res.json({ success: true, message: 'Comment added' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/like
 * Toggle like status.
 */
router.post('/:doctype/:id/like', async (req, res, next) => {
  try {
    const { doctype, id } = req.params;
    const { action } = req.body; // 'LIKE' or 'UNLIKE'
    
    EventEngine.emit(action === 'UNLIKE' ? `${doctype}.unliked` : `${doctype}.liked`, 
      { doctype, doc_id: id },
      { tenant_id: req.tenantId, user_id: req.userId, user_name: req.user?.full_name || 'System' }
    );
    
    res.json({ success: true, message: action === 'UNLIKE' ? 'Unliked' : 'Liked' });
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

/**
 * POST /api/v1/doc/:doctype/:id/toggle-lock
 * Toggle Lock status (Quick Action).
 */
router.post('/:doctype/:id/toggle-lock', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.toggleLock(req.params.doctype, req.params.id, req.body.status, req.tenantId, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// --- PRINT ENDPOINTS ---

const getPrintEngine = () => Container.resolve('PrintEngine');

/**
 * GET /api/v1/doc/:doctype/:id/print
 * Returns HTML for printing
 */
router.get('/:doctype/:id/print', async (req, res, next) => {
  try {
    const printEngine = getPrintEngine();
    const html = await printEngine.renderHtml(req.params.doctype, req.params.id, req.tenantId, req.userId, req.query.format);
    res.send(html);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id/pdf
 * Returns PDF document for download
 */
router.get('/:doctype/:id/pdf', async (req, res, next) => {
  try {
    const printEngine = getPrintEngine();
    const pdfBuffer = await printEngine.renderPdf(req.params.doctype, req.params.id, req.tenantId, req.userId, req.query.format);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.doctype}-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// --- IMPORT & EXPORT ENDPOINTS ---

const getDataEngine = () => Container.resolve('DataEngine');

/**
 * GET /api/v1/doc/:doctype/export?format=csv
 * Export data to CSV or XLSX
 */
router.get('/:doctype/export', async (req, res, next) => {
  try {
    const dataEngine = getDataEngine();
    const format = req.query.format || 'csv';
    const result = await dataEngine.exportData(req.params.doctype, req.query, format, req.tenantId, req.userId);
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.doctype}-export.${result.extension}"`);
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/import
 * Import data from CSV
 */
router.post('/:doctype/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const dataEngine = getDataEngine();
    const result = await dataEngine.importData(req.params.doctype, req.file.path, req.tenantId, req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// --- VERSION ENDPOINTS ---

const getVersionEngine = () => Container.resolve('VersionEngine');

/**
 * GET /api/v1/doc/:doctype/:id/versions
 * List all versions for a document
 */
router.get('/:doctype/:id/versions', async (req, res, next) => {
  try {
    const versionEngine = getVersionEngine();
    const versions = await versionEngine.getVersions(req.params.doctype, req.params.id, req.tenantId);
    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id/versions/compare
 * Compare two versions (passed via query params v1 and v2)
 */
router.get('/:doctype/:id/versions/compare', async (req, res, next) => {
  try {
    const { v1, v2 } = req.query;
    if (!v1 || !v2) {
      return res.status(400).json({ success: false, message: 'v1 and v2 query parameters are required' });
    }
    const versionEngine = getVersionEngine();
    const comparison = await versionEngine.compareVersions(req.params.doctype, req.params.id, Number(v1), Number(v2), req.tenantId);
    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id/versions/:version
 * Get a specific version snapshot
 */
router.get('/:doctype/:id/versions/:version', async (req, res, next) => {
  try {
    const versionEngine = getVersionEngine();
    const version = await versionEngine.getVersion(req.params.doctype, req.params.id, Number(req.params.version), req.tenantId);
    res.json({ success: true, data: version });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/versions/:version/restore
 * Restore document to version
 */
router.post('/:doctype/:id/versions/:version/restore', async (req, res, next) => {
  try {
    const versionEngine = getVersionEngine();
    const result = await versionEngine.restoreVersion(req.params.doctype, req.params.id, Number(req.params.version), req.tenantId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// --- WORKFLOW ENDPOINTS ---

const getWorkflowEngine = () => Container.resolve('WorkflowEngine');

/**
 * GET /api/v1/doc/:doctype/:id/workflow
 * Get current workflow state and available transitions
 */
router.get('/:doctype/:id/workflow', async (req, res, next) => {
  try {
    const wfEngine = getWorkflowEngine();
    const transitions = await wfEngine.getAvailableTransitions(req.params.doctype, req.params.id, req.tenantId, req.user);
    res.json({ success: true, data: { available_transitions: transitions } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/workflow/transition
 * Execute a workflow transition
 */
router.post('/:doctype/:id/workflow/transition', async (req, res, next) => {
  try {
    const wfEngine = getWorkflowEngine();
    const record = await wfEngine.executeTransition(
      req.params.doctype, 
      req.params.id, 
      req.body.action_key, 
      req.body.comment, 
      req.tenantId, 
      req.user
    );
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id/workflow/history
 * Get workflow history
 */
router.get('/:doctype/:id/workflow/history', async (req, res, next) => {
  try {
    const wfEngine = getWorkflowEngine();
    const history = await wfEngine.getHistory(req.params.doctype, req.params.id, req.tenantId);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

export default router;
