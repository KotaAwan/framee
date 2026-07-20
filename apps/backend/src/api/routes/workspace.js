import express from 'express';
import { tenantAuth } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { config } from '../../config/env.js';

const router = express.Router();

/**
 * GET /api/v1/workspace
 * Returns a list of all active modules and their workspace shortcuts.
 */
/**
 * GET /api/v1/workspace
 * Returns a list of all active modules and their workspace shortcuts.
 */
router.get('/', tenantAuth, async (req, res, next) => {
  try {
    const tenant_id = req.tenantId;
    const user_id = req.userId;
    const dbEngine = Container.resolve('DatabaseEngine');
    
    // We fetch globally (tenantless setup or system tenant for now)
    const knex = dbEngine.getRawConnection();

    // 1. Get user roles
    const userRoles = await knex('sys_user_role')
      .where({ user_id: user_id, is_deleted: false, status: 'Saved' })
      .select('role_id');
    const roleIds = userRoles.map(r => r.role_id);

    if (roleIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. Get workspaces (menu assignments) for these roles
    const workspaces = await knex('sys_workspace')
      .whereIn('role_id', roleIds)
      .where({ is_deleted: false, status: 'Saved' })
      .orderBy('sort_order', 'asc');
    
    const menuIds = [...new Set(workspaces.map(w => w.menu_id))];

    if (menuIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 3. Get menus
    const menus = await knex('sys_menu')
      .whereIn('id', menuIds)
      .where({ is_deleted: false, status: 'Saved' });
      
    const doctypesNeeded = [...new Set(menus.map(m => m.doctype))];

    // 4. Get doctypes
    const doctypes = await knex('sys_doctype')
      .whereIn('table_name', doctypesNeeded)
      .where({ is_deleted: false, status: 'Saved' });
      
    const doctypeMap = new Map();
    doctypes.forEach(dt => doctypeMap.set(dt.table_name, dt));

    const moduleIdsNeeded = [...new Set(doctypes.map(dt => dt.module_id))];

    // 5. Get modules
    const modules = await knex('sys_module')
      .whereIn('id', moduleIdsNeeded)
      .where({ is_deleted: false, status: 'Saved' })
      .orderBy('name', 'asc');

    // 6. Assemble
    // First, map each menu to its doctype and module
    const enrichedMenus = menus.map(menu => {
      const dt = doctypeMap.get(menu.doctype);
      if (!dt) return null;
      // Get the sort_order from the first matching workspace record
      const ws = workspaces.find(w => w.menu_id === menu.id);
      return {
        id: menu.id,
        name: menu.name,
        doctype: dt.slug, // The target URL slug for the doctype
        icon: dt.icon,
        module_id: dt.module_id,
        sort_order: ws ? ws.sort_order : 999
      };
    }).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order);

    const result = modules.map(mod => {
      return {
        id: mod.id,
        name: mod.name,
        slug: mod.slug, // The target URL slug for the module
        icon: mod.icon,
        shortcuts: enrichedMenus.filter(m => m.module_id === mod.id)
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
