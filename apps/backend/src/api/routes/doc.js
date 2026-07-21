import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import Container from '../../core/Container.js';
import { authMiddleware } from '../middlewares/tenantAuth.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

/**
 * Middleware to resolve the CRUDEngine for these routes.
 */
const getCrudEngine = () => Container.resolve('CRUDEngine');

/**
 * Hash password fields before saving to DB.
 * Applies bcrypt to password_hash and pin_hash if they are non-empty plain text.
 */
const BCRYPT_SALT_ROUNDS = 12;
const hashPasswordFields = async (data) => {
  const result = { ...data };
  if (result.password_hash && !result.password_hash.startsWith('$2b$')) {
    result.password_hash = await bcrypt.hash(result.password_hash, BCRYPT_SALT_ROUNDS);
  }
  if (result.pin_hash && !result.pin_hash.startsWith('$2b$')) {
    result.pin_hash = await bcrypt.hash(result.pin_hash, BCRYPT_SALT_ROUNDS);
  }
  return result;
};

// All /doc routes require auth
router.use(authMiddleware);

/**
 * Helper to remove sensitive fields from a document before sending to the client.
 */
const sanitizeDoc = (doc) => {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(sanitizeDoc);
  const sensitiveFields = ['password', 'password_hash', 'pin', 'pin_hash', 'google_id'];
  const sanitized = { ...doc };
  sensitiveFields.forEach(f => delete sanitized[f]);
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

// --- IMPORT & EXPORT ENDPOINTS (Must be defined BEFORE /:doctype/:id to avoid conflict) ---
const getDataEngine = () => Container.resolve('DataEngine');

/**
 * GET /api/v1/doc/:doctype/export
 * Export data to CSV, XLSX, or PDF
 */
router.get('/:doctype/export', async (req, res, next) => {
  try {
    console.log(`\n***`);
    console.log(`*** GET Export Doctype: "${req.params.doctype}" | Format: "${req.query.format}"`);
    const dataEngine = getDataEngine();
    const format = req.query.format || 'xlsx';
    
    // Destructure format out to avoid passing it as a database filter query field
    const { format: _, ...filters } = req.query;
    const result = await dataEngine.exportData(req.params.doctype, filters, format, req.userId);
    
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
    console.log(`\n***`);
    console.log(`*** POST Import Doctype: "${req.params.doctype}"`);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const dataEngine = getDataEngine();
    const result = await dataEngine.importData(req.params.doctype, req.file.path, req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype
 * Get a list of documents.
 */
router.get('/:doctype', async (req, res, next) => {
  try {
    console.log(`\n***`);
    console.log(`*** GET List Doctype: "${req.params.doctype}"`);
    const crudEngine = getCrudEngine();
    const records = await crudEngine.getList(req.params.doctype, req.query, req.userId);
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
    console.log(`\n***`);
    console.log(`*** GET Doctype: "${req.params.doctype}" | ID: "${req.params.id}"`);
    const crudEngine = getCrudEngine();
    const record = await crudEngine.get(req.params.doctype, req.params.id, req.userId);
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
    console.log(`\n***`);
    console.log(`*** POST Doctype: "${req.params.doctype}" | New`);
    const crudEngine = getCrudEngine();
    const body = await hashPasswordFields(req.body);
    const record = await crudEngine.insert(req.params.doctype, body, req.userId);
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
    console.log(`\n***`);
    console.log(`*** PUT Doctype: "${req.params.doctype}" | ID: "${req.params.id}"`);
    const crudEngine = getCrudEngine();
    const body = await hashPasswordFields(req.body);
    const record = await crudEngine.update(req.params.doctype, req.params.id, body, req.userId);
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
    console.log(`\n***`);
    console.log(`*** DELETE Doctype: "${req.params.doctype}" | ID: "${req.params.id}"`);
    const crudEngine = getCrudEngine();
    const result = await crudEngine.delete(req.params.doctype, req.params.id, req.userId, req.body.delete_reason);
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
      { user_id: req.userId, user_name: req.user?.full_name || 'System' }
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
      { user_id: req.userId, user_name: req.user?.full_name || 'System' }
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
    const record = await crudEngine.submit(req.params.doctype, req.params.id, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/cancel
 * Cancel a submitted document.
 */
router.post('/:doctype/:id/cancel', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.cancel(req.params.doctype, req.params.id, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/lock
 * Lock a document.
 */
router.post('/:doctype/:id/lock', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.lock(req.params.doctype, req.params.id, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/unlock
 * Unlock a document.
 */
router.post('/:doctype/:id/unlock', async (req, res, next) => {
  try {
    const crudEngine = getCrudEngine();
    const record = await crudEngine.unlock(req.params.doctype, req.params.id, req.userId);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doc/:doctype/:id/workflow/transition
 * Trigger a workflow transition.
 */
const getWorkflowEngine = () => Container.resolve('WorkflowEngine');
router.post('/:doctype/:id/workflow/transition', async (req, res, next) => {
  try {
    const wfEngine = getWorkflowEngine();
    const user = req.user || { id: req.userId, is_system_user: true };
    const record = await wfEngine.executeTransition(
      req.params.doctype, 
      req.params.id, 
      req.body.action, 
      req.body.comment, 
      user
    );
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
    const html = await printEngine.renderHtml(req.params.doctype, req.params.id, req.userId, req.query.format);
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
    const pdfBuffer = await printEngine.renderPdf(req.params.doctype, req.params.id, req.userId, req.query.format);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.doctype}-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
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
    const versions = await versionEngine.getVersions(req.params.doctype, req.params.id);
    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/doc/:doctype/:id/versions/compare
 * Compare two versions
 */
router.get('/:doctype/:id/versions/compare', async (req, res, next) => {
  try {
    const { v1, v2 } = req.query;
    if (!v1 || !v2) {
      return res.status(400).json({ success: false, message: 'v1 and v2 query parameters are required' });
    }
    const versionEngine = getVersionEngine();
    const comparison = await versionEngine.compareVersions(req.params.doctype, req.params.id, Number(v1), Number(v2));
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
    const version = await versionEngine.getVersion(req.params.doctype, req.params.id, Number(req.params.version));
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
    const result = await versionEngine.restoreVersion(req.params.doctype, req.params.id, Number(req.params.version), req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// --- WORKFLOW ENDPOINTS ---

/**
 * GET /api/v1/doc/:doctype/:id/workflow
 * Get current workflow state and available transitions
 */
router.get('/:doctype/:id/workflow', async (req, res, next) => {
  try {
    const wfEngine = getWorkflowEngine();
    const user = req.user || { id: req.userId, is_system_user: true };
    const transitions = await wfEngine.getAvailableTransitions(req.params.doctype, req.params.id, user);
    res.json({ success: true, data: { available_transitions: transitions } });
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
    const history = await wfEngine.getHistory(req.params.doctype, req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

export default router;
