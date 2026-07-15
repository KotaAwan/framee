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
    const dbEngine = Container.resolve('DatabaseEngine');
    
    // We need to fetch from both the System Tenant (global modules) and the specific user's Tenant
    const SYSTEM_TENANT = config.app.systemTenantId;
    
    // 1. Fetch Modules
    const systemModules = await dbEngine.query('sys_module', SYSTEM_TENANT)
      .where({ status: 'Active' });
      
    let userModules = [];
    if (tenant_id !== SYSTEM_TENANT) {
      userModules = await dbEngine.query('sys_module', tenant_id)
        .where({ status: 'Active' });
    }
    
    const modules = [...systemModules, ...userModules].sort((a, b) => a.name.localeCompare(b.name));

    // 2. Fetch Shortcuts
    const moduleIds = modules.map(m => m.id);
    
    let shortcuts = [];
    if (moduleIds.length > 0) {
      const systemShortcuts = await dbEngine.query('sys_workspace_shortcut', SYSTEM_TENANT)
        .whereIn('module_id', moduleIds)
        .where({ status: 'Active' });
        
      let userShortcuts = [];
      if (tenant_id !== SYSTEM_TENANT) {
        userShortcuts = await dbEngine.query('sys_workspace_shortcut', tenant_id)
          .whereIn('module_id', moduleIds)
          .where({ status: 'Active' });
      }
      
      shortcuts = [...systemShortcuts, ...userShortcuts].sort((a, b) => a.sort_order - b.sort_order);
    }

    // 2.5 Fetch DocTypes to inject their icons into shortcuts
    const systemDocTypes = await dbEngine.query('sys_doctype', SYSTEM_TENANT).select('name', 'icon');
    let userDocTypes = [];
    if (tenant_id !== SYSTEM_TENANT) {
      userDocTypes = await dbEngine.query('sys_doctype', tenant_id).select('name', 'icon');
    }
    const allDocTypes = [...systemDocTypes, ...userDocTypes];
    const doctypeIconMap = {};
    allDocTypes.forEach(dt => {
      if (dt.icon) doctypeIconMap[dt.name] = dt.icon;
    });

    // 3. Group shortcuts by module and inject icon
    const result = modules.map(m => {
      return {
        ...m,
        shortcuts: shortcuts
          .filter(s => s.module_id === m.id)
          .map(s => {
            if (s.type === 'DocType' && doctypeIconMap[s.target]) {
              s.icon = doctypeIconMap[s.target];
            }
            return s;
          })
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
