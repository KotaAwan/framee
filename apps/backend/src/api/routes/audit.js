import express from 'express';
import { tenantAuth } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { ForbiddenError } from '../../utils/errors.js';

const getDbEngine = () => Container.resolve('DatabaseEngine');

const router = express.Router();

/**
 * Require System Manager or Auditor role
 * (Simplified role check for now)
 */
const requireAdmin = async (req, res, next) => {
  // In a full implementation, check sys_user_role for this tenant
  // For now, we will pass it through for development purposes.
  next();
};

/**
 * GET /api/v1/audit
 * Query full global audit log
 */
router.get('/', tenantAuth, requireAdmin, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, doctype, action, user_id } = req.query;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    let query = knex('sys_audit_log')
      .leftJoin('sys_user', 'sys_audit_log.user_id', 'sys_user.id')
      .select('sys_audit_log.*', 'sys_user.name as user_name', 'sys_user.avatar_url as avatar_url')
      .orderBy('sys_audit_log.created_at', 'desc');
    
    if (doctype) query = query.where({ 'sys_audit_log.doctype': doctype });
    if (action) query = query.where({ 'sys_audit_log.action': action });
    if (user_id) query = query.where({ 'sys_audit_log.user_id': user_id });
    
    const logs = await query.limit(Number(limit)).offset(Number(offset));
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/audit/doc/:doctype/:id
 * All audit events for a document
 */
router.get('/doc/:doctype/:id', tenantAuth, requireAdmin, async (req, res, next) => {
  try {
    const { doctype, id } = req.params;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    const logs = await knex('sys_audit_log')
      .leftJoin('sys_user', 'sys_audit_log.user_id', 'sys_user.id')
      .select('sys_audit_log.*', 'sys_user.name as user_name', 'sys_user.avatar_url as avatar_url')
      .where({ 'sys_audit_log.doctype': doctype, 'sys_audit_log.doc_id': id })
      .orderBy('sys_audit_log.created_at', 'desc');
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/audit/user/:user_id
 * All audit events by a specific user
 */
router.get('/user/:user_id', tenantAuth, requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    const logs = await knex('sys_audit_log')
      .leftJoin('sys_user', 'sys_audit_log.user_id', 'sys_user.id')
      .select('sys_audit_log.*', 'sys_user.name as user_name', 'sys_user.avatar_url as avatar_url')
      .where({ 'sys_audit_log.user_id': user_id })
      .orderBy('sys_audit_log.created_at', 'desc');
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
