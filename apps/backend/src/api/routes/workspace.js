import express from 'express';
import { authMiddleware } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { config } from '../../config/env.js';

const router = express.Router();

/**
 * GET /api/v1/workspace
 * Returns a list of all active modules and their workspace shortcuts.
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.userId;
    const dbEngine = Container.resolve('DatabaseEngine');
    
    const knex = dbEngine.getRawConnection();

    // 1. Get user roles
    const userRoles = await knex('sys_user_role')
      .where({ user_id: user_id, is_deleted: false, status: 'Saved' })
      .select('role_id');
    const roleIds = userRoles.map(r => r.role_id);

    if (roleIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. Get Permissions for these roles that allow reading
    const permissions = await knex('sys_permission')
      .whereIn('role_id', roleIds)
      .where({ is_deleted: false, status: 'Saved', can_read: 1 })
      .select('doctype'); // doctype is table_name
      
    const permittedDoctypes = [...new Set(permissions.map(p => p.doctype))];
    
    if (permittedDoctypes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 3. Get Doctypes
    const doctypes = await knex('sys_doctype')
      .whereIn('table_name', permittedDoctypes)
      .where({ is_deleted: false, status: 'Saved' })
      .orderBy('name', 'asc');
      
    if (doctypes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 4. Get Modules
    const moduleIds = [...new Set(doctypes.map(d => d.module_id))];
    const modules = await knex('sys_module')
      .whereIn('id', moduleIds)
      .where({ is_deleted: false, status: 'Saved' })
      .orderBy('name', 'asc');
      
    // 5. Assemble
    const result = modules.map(mod => {
      const moduleDoctypes = doctypes.filter(dt => dt.module_id === mod.id);
      return {
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        icon: mod.icon,
        shortcuts: moduleDoctypes.map(dt => ({
          id: dt.id,
          name: dt.name,
          doctype: dt.slug, // Target URL slug uses doctype slug
          icon: dt.icon,
          module_id: dt.module_id,
          sort_order: 1 // Default sort order
        }))
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
