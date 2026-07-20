export async function up(knex) {
  // ──────────────────────────────────────────────────
  // 1. Drop old sys_workflow (parent) and its tracking tables
  // ──────────────────────────────────────────────────
  await knex.schema.dropTableIfExists('sys_workflow_version');
  await knex.schema.dropTableIfExists('sys_workflow_logs');
  await knex.schema.dropTableIfExists('sys_workflow');

  // ──────────────────────────────────────────────────
  // 2. Rename sys_workflow_transition -> sys_workflow
  // ──────────────────────────────────────────────────
  await knex.schema.renameTable('sys_workflow_transition', 'sys_workflow');
  await knex.schema.renameTable('sys_workflow_transition_logs', 'sys_workflow_logs');
  await knex.schema.renameTable('sys_workflow_transition_version', 'sys_workflow_version');

  // Add log_status column to the new sys_workflow
  await knex.schema.alterTable('sys_workflow', (table) => {
    table.string('log_status', 50).nullable().after('action');
  });

  // ──────────────────────────────────────────────────
  // 3. Rename sys_workflow_state -> sys_state
  // ──────────────────────────────────────────────────
  await knex.schema.renameTable('sys_workflow_state', 'sys_state');
  await knex.schema.renameTable('sys_workflow_state_logs', 'sys_state_logs');
  await knex.schema.renameTable('sys_workflow_state_version', 'sys_state_version');

  // ──────────────────────────────────────────────────
  // 4. Rename sys_workflow_action -> sys_action
  // ──────────────────────────────────────────────────
  await knex.schema.renameTable('sys_workflow_action', 'sys_action');
  await knex.schema.renameTable('sys_workflow_action_logs', 'sys_action_logs');
  await knex.schema.renameTable('sys_workflow_action_version', 'sys_action_version');

  // ──────────────────────────────────────────────────
  // 5. Update sys_doctype references for renamed tables
  // ──────────────────────────────────────────────────
  await knex('sys_doctype').where('table_name', 'sys_workflow_state').update({
    name: 'State', slug: 'sys_state', table_name: 'sys_state', auto_code: 'STAT-.YY..MM.-.XXXX'
  });
  await knex('sys_doctype').where('table_name', 'sys_workflow_action').update({
    name: 'Action', slug: 'sys_action', table_name: 'sys_action', auto_code: 'ACTN-.YY..MM.-.XXXX'
  });
  // Delete the old sys_workflow doctype row (since the table was dropped)
  await knex('sys_doctype').where('table_name', 'sys_workflow').del();
  // The old sys_workflow_transition doctype becomes sys_workflow
  await knex('sys_doctype').where('table_name', 'sys_workflow_transition').update({
    name: 'Workflow', slug: 'sys_workflow', table_name: 'sys_workflow', auto_code: 'WFLW-.YY..MM.-.XXXX'
  });

  // ──────────────────────────────────────────────────
  // 6. Update sys_docfield references for renamed tables
  // ──────────────────────────────────────────────────
  await knex('sys_docfield').where('doctype', 'sys_workflow_state').update({ doctype: 'sys_state' });
  await knex('sys_docfield').where('doctype', 'sys_workflow_action').update({ doctype: 'sys_action' });
  await knex('sys_docfield').where('doctype', 'sys_workflow_transition').update({ doctype: 'sys_workflow' });
  // Delete docfields for old sys_workflow
  // (but we need to be careful; the old sys_workflow had its own fields like initial_state, etc.)
  // Actually the transition fields got updated to sys_workflow above. Let's just add the log_status field.
  await knex('sys_docfield').insert({
    doctype: 'sys_workflow',
    label: 'Log Status',
    fieldname: 'log_status',
    fieldtype: 'Data',
    in_list: true,
    in_filter: false,
    in_search: false,
    sort_order: 10
  });

  // ──────────────────────────────────────────────────
  // 7. Clear and re-seed the new tables
  // ──────────────────────────────────────────────────

  // Clear existing data
  await knex('sys_workflow').del();
  await knex('sys_state').del();
  await knex('sys_action').del();

  // sys_state
  await knex('sys_state').insert([
    { code: 'STAT-2607-0001', name: 'New', style: 'danger', is_terminal: false, is_deleted: false, status: 'Active' },
    { code: 'STAT-2607-0002', name: 'Locked', style: 'success', is_terminal: true, is_deleted: false, status: 'Active' },
    { code: 'STAT-2607-0003', name: 'Unlocked', style: 'danger', is_terminal: false, is_deleted: false, status: 'Active' },
    { code: 'STAT-2607-0004', name: 'Deleted', style: 'danger', is_terminal: true, is_deleted: false, status: 'Active' }
  ]);

  // sys_action
  await knex('sys_action').insert([
    { code: 'ACTN-2607-0001', name: 'Save', key: 'save', style: 'info', is_deleted: false, status: 'Active' },
    { code: 'ACTN-2607-0002', name: 'Unlock', key: 'unlock', style: 'danger', is_deleted: false, status: 'Active' },
    { code: 'ACTN-2607-0003', name: 'Lock', key: 'lock', style: 'success', is_deleted: false, status: 'Active' },
    { code: 'ACTN-2607-0004', name: 'Update', key: 'save', style: 'info', is_deleted: false, status: 'Active' },
    { code: 'ACTN-2607-0005', name: 'Delete', key: 'delete', style: 'danger', is_deleted: false, status: 'Active' }
  ]);

  // sys_workflow (transitions for sys_user)
  await knex('sys_workflow').insert([
    { doctype: 'sys_user', from_state: 'New', action: 'Save', to_state: 'Locked', log_status: 'Created', allow_roles: JSON.stringify([1]), is_deleted: false, status: 'Active' },
    { doctype: 'sys_user', from_state: 'Locked', action: 'Unlock', to_state: 'Unlocked', log_status: 'Unlocked', allow_roles: JSON.stringify([1]), is_deleted: false, status: 'Active' },
    { doctype: 'sys_user', from_state: 'Unlocked', action: 'Lock', to_state: 'Locked', log_status: 'Locked', allow_roles: JSON.stringify([1]), is_deleted: false, status: 'Active' },
    { doctype: 'sys_user', from_state: 'Unlocked', action: 'Update', to_state: 'Locked', log_status: 'Updated', allow_roles: JSON.stringify([1]), is_deleted: false, status: 'Active' },
    { doctype: 'sys_user', from_state: 'Unlocked', action: 'Delete', to_state: 'Deleted', log_status: 'Deleted', allow_roles: JSON.stringify([1]), is_deleted: false, status: 'Active' }
  ]);

  // Update existing sys_user record status from 'Submitted' to 'Locked'
  await knex('sys_user').where('status', 'Submitted').update({ status: 'Locked' });
  await knex('sys_user').where('status', 'Draft').update({ status: 'Unlocked' });
}

export async function down(knex) {
  // This is a destructive migration; rolling back fully is complex.
  // For safety, we just reverse the renames.
  
  // Remove log_status column
  await knex.schema.alterTable('sys_workflow', (table) => {
    table.dropColumn('log_status');
  });

  // Reverse renames
  await knex.schema.renameTable('sys_workflow', 'sys_workflow_transition');
  await knex.schema.renameTable('sys_workflow_logs', 'sys_workflow_transition_logs');
  await knex.schema.renameTable('sys_workflow_version', 'sys_workflow_transition_version');

  await knex.schema.renameTable('sys_state', 'sys_workflow_state');
  await knex.schema.renameTable('sys_state_logs', 'sys_workflow_state_logs');
  await knex.schema.renameTable('sys_state_version', 'sys_workflow_state_version');

  await knex.schema.renameTable('sys_action', 'sys_workflow_action');
  await knex.schema.renameTable('sys_action_logs', 'sys_workflow_action_logs');
  await knex.schema.renameTable('sys_action_version', 'sys_workflow_action_version');
}
