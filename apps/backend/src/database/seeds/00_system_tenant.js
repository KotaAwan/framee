export async function seed(knex) {
  const TENANT_SYSTEM = '2607-00001'; // Global System Tenant

  // Clear existing to ensure idempotency
  await knex('sys_tenant').where('id', TENANT_SYSTEM).del();

  // Insert System Tenant
  await knex('sys_tenant').insert({
    id: TENANT_SYSTEM,
    name: 'System',
    is_active: true,
    status: 'Active',
    created_at: new Date(),
    updated_at: new Date()
  });
}
