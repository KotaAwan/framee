import express from 'express';
import { authMiddleware } from '../middlewares/tenantAuth.js';
import Container from '../../core/Container.js';
import { config } from '../../config/env.js';

const router = express.Router();

/**
 * GET /api/v1/workspace
 * Returns a list of workspace groups and their shortcuts based on global sys_workspace and user permissions.
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.userId;
    const dbEngine = Container.resolve('DatabaseEngine');
    
    const knex = dbEngine.getRawConnection();

    // 1. Get user roles (needed for checking sys_permission)
    const userRoles = await knex('sys_user_role')
      .where({ user_id: user_id, is_deleted: false, status: 'Saved' })
      .select('role_id');
    const roleIds = userRoles.map(r => r.role_id);

    // 2. Get global sys_workspace entries
    const workspaceEntries = await knex('sys_workspace')
      .where({ is_deleted: false, status: 'Saved' })
      .orderBy('sort_order', 'asc');

    if (workspaceEntries.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // We only want unique doctypes per workspace group in case multiple roles add the same thing
    const targetDoctypes = [...new Set(workspaceEntries.map(w => w.doctype))];

    // 3. Get Permissions to ensure user can actually read these doctypes
    // A System User bypasses explicit permissions
    const user = await knex('sys_user').where({ id: user_id }).first();
    let permittedDoctypes = [];
    
    if (user && user.is_system_user) {
      permittedDoctypes = targetDoctypes;
    } else {
      if (roleIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      
      const permissions = await knex('sys_permission')
        .whereIn('role_id', roleIds)
        .where({ is_deleted: false, status: 'Saved', can_read: 1 })
        .whereIn('doctype', targetDoctypes)
        .select('doctype');
        
      permittedDoctypes = [...new Set(permissions.map(p => p.doctype))];
    }

    if (permittedDoctypes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 4. Get sys_doctype records to get label names and icons
    const doctypes = await knex('sys_doctype')
      .whereIn('table_name', permittedDoctypes)
      .where({ is_deleted: false, status: 'Saved' });
      
    // 5. Get sys_module records to get the group slug (for URL construction) and group icon
    const moduleIds = [...new Set(workspaceEntries.map(w => w.module_id))].filter(Boolean);
    const modules = await knex('sys_module')
      .whereIn('id', moduleIds)
      .where({ is_deleted: false, status: 'Saved' });
      
    // Create quick lookups
    const doctypeMap = {};
    doctypes.forEach(dt => { doctypeMap[dt.table_name] = dt; });
    
    const moduleMap = {};
    modules.forEach(m => { moduleMap[m.id] = m; });

    // 6. Assemble the Result grouped by module_id / module name
    const groupedWorkspaces = {};

    workspaceEntries.forEach(ws => {
      // Skip if user doesn't have read permission for this doctype
      if (!permittedDoctypes.includes(ws.doctype)) return;
      
      const dtInfo = doctypeMap[ws.doctype];
      if (!dtInfo) return; // Doctype might be deleted or doesn't exist

      const modInfo = moduleMap[ws.module_id];
      const groupKey = modInfo ? modInfo.name : ws.name;
      
      if (!groupedWorkspaces[groupKey]) {
        groupedWorkspaces[groupKey] = {
          id: modInfo ? modInfo.id : groupKey,
          name: groupKey,
          slug: modInfo ? modInfo.slug : groupKey.toLowerCase().replace(/\s+/g, '-'),
          icon: modInfo ? modInfo.icon : 'Layout',
          shortcuts: []
        };
      }
      
      // Ensure we don't add duplicates
      const exists = groupedWorkspaces[groupKey].shortcuts.find(s => s.doctype === ws.doctype);
      if (!exists) {
        groupedWorkspaces[groupKey].shortcuts.push({
          id: dtInfo.id,
          name: dtInfo.name,
          doctype: dtInfo.slug, // Frontend routes using the doc slug
          icon: dtInfo.icon,
          module_id: dtInfo.module_id,
          sort_order: ws.sort_order
        });
      }
    });

    // Convert object to array
    // To sort the groups themselves, we can preserve the order of the first time the group appeared in the sorted workspaceEntries
    const result = [];
    workspaceEntries.forEach(ws => {
      const modInfo = moduleMap[ws.module_id];
      const groupKey = modInfo ? modInfo.name : ws.name;
      if (groupedWorkspaces[groupKey] && !result.find(r => r.name === groupKey)) {
        result.push(groupedWorkspaces[groupKey]);
      }
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
