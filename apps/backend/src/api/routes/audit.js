import express from 'express';
import { authMiddleware } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { ForbiddenError } from '../../utils/errors.js';

const getDbEngine = () => Container.resolve('DatabaseEngine');

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  next();
};

/**
 * GET /api/v1/audit
 * Query full global audit log
 */
router.get('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, doctype, action, user_id } = req.query;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    
    if (doctype) {
      const metaEngine = (await import('../../core/Container.js')).default.resolve('MetadataEngine');
      const meta = await metaEngine.getDocType(doctype);
      if (!meta) return res.status(404).json({ success: false, message: `DocType ${doctype} not found.` });
      
      const localLogTable = `${meta.table_name}_logs`;
      
      let query = knex(localLogTable)
        .leftJoin('sys_user', `${localLogTable}.created_by`, 'sys_user.id')
        .select(
          `${localLogTable}.id as id`,
          `${localLogTable}.doc_id as doc_id`,
          `${localLogTable}.status as action`,
          `${localLogTable}.content as content`,
          `${localLogTable}.created_at as created_at`,
          'sys_user.name as user_name',
          'sys_user.avatar_url as avatar_url',
          'sys_user.id as user_id'
        )
        .orderBy(`${localLogTable}.created_at`, 'desc');
        
      if (user_id) query = query.where({ [`${localLogTable}.created_by`]: user_id });
      
      const logs = await query.limit(Number(limit)).offset(Number(offset));
      return res.json({
        success: true,
        data: logs
      });
    }
    
    let query = knex('sys_audit_log')
      .leftJoin('sys_user', 'sys_audit_log.user_id', 'sys_user.id')
      .select('sys_audit_log.*', 'sys_user.name as user_name', 'sys_user.avatar_url as avatar_url')
      .orderBy('sys_audit_log.created_at', 'desc');
    
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
router.get('/doc/:doctype/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { doctype, id } = req.params;
    
    const dbEngine = getDbEngine();
    const knex = dbEngine.getRawConnection();
    const metaEngine = (await import('../../core/Container.js')).default.resolve('MetadataEngine');
    const meta = await metaEngine.getDocType(doctype);
    if (!meta) return res.status(404).json({ success: false, message: `DocType ${doctype} not found.` });
    
    const localLogTable = `${meta.table_name}_logs`;
    
    const logs = await knex(localLogTable)
      .leftJoin('sys_user', `${localLogTable}.created_by`, 'sys_user.id')
      .select(
        `${localLogTable}.id as id`,
        `${localLogTable}.doc_id as doc_id`,
        `${localLogTable}.status as action`,
        `${localLogTable}.content as content`,
        `${localLogTable}.created_at as created_at`,
        'sys_user.name as user_name',
        'sys_user.avatar_url as avatar_url',
        'sys_user.id as user_id'
      )
      .where({ [`${localLogTable}.doc_id`]: id })
      .orderBy(`${localLogTable}.created_at`, 'desc');
    
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
router.get('/user/:user_id', authMiddleware, requireAdmin, async (req, res, next) => {
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
