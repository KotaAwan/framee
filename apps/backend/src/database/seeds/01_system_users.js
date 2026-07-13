import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function seed(knex) {
  // Clear existing users to prevent conflicts
  await knex('sys_user').del();

  const tenantId = '00000000-0000-0000-0000-000000000001'; // Default system tenant
  const adminId = '00000000-0000-0000-0000-000000000002'; // Default admin id
  const passwordHash = await bcrypt.hash('admin123', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  const adminUser = {
    id: adminId,
    tenant_id: tenantId,
    full_name: 'System Administrator',
    email: 'admin@framee.com',
    password_hash: passwordHash,
    pin_hash: pinHash,
    status: 'Active',
    is_system_user: true,
    language: 'en',
    timezone: 'UTC'
  };

  await knex('sys_user').insert(adminUser);
}
