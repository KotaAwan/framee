import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from '../../src/server.js';
import Container from '../../src/core/Container.js';

const TEST_TENANT = uuidv4();
const SYSTEM_MANAGER_ID = 'system-manager-mock-id';
const NORMAL_USER_ID = uuidv4();

let app;

describe('Lifecycle & Permission Engine', () => {
  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    const db = Container.resolve('DatabaseEngine');
    const cache = Container.resolve('CacheEngine');
    await db.close();
    await cache.close();
    Container.clear();
  });

  beforeEach(async () => {
    const db = Container.resolve('DatabaseEngine');
    const cache = Container.resolve('CacheEngine');

    // Clean up cache
    await cache.del(`framee:perm:${TEST_TENANT}:${NORMAL_USER_ID}`);
    await cache.del(`framee:meta:${TEST_TENANT}:Invoice`);
    
    // Clean up test tables
    await db.query('sys_user_role', TEST_TENANT, { includeDeleted: true }).delete();
    await db.query('sys_permission', TEST_TENANT, { includeDeleted: true }).delete();
    await db.query('sys_role', TEST_TENANT, { includeDeleted: true }).delete();
    await db.query('sys_docfield', TEST_TENANT, { includeDeleted: true }).delete();
    await db.query('sys_doctype', TEST_TENANT, { includeDeleted: true }).delete();
    
    await db.getRawConnection().schema.dropTableIfExists('dt_invoice');

    // Create dynamic table dt_invoice
    await db.getRawConnection().schema.createTable('dt_invoice', (table) => {
      table.uuid('id').primary();
      table.uuid('tenant_id').notNullable();
      table.string('status', 20).defaultTo('Draft');
      table.integer('total');
      table.string('notes');
      table.uuid('created_by');
      table.uuid('updated_by');
      table.datetime('created_at');
      table.datetime('updated_at');
      table.datetime('deleted_at');
      table.uuid('deleted_by');
      table.text('delete_reason');
      table.datetime('submitted_at');
      table.uuid('submitted_by');
      table.datetime('cancelled_at');
      table.uuid('cancelled_by');
      table.text('cancel_reason');
    });

    // Seed Metadata for 'Invoice'
    const docId = uuidv4();
    await db.getRawConnection()('sys_doctype').insert({
      id: docId,
      tenant_id: TEST_TENANT,
      name: 'Invoice',
      is_active: true,
      has_lifecycle: true,
      initial_status: 'Draft',
      allow_edit_after_submit: false,
      allow_cancel: true,
      lock_on_submit: true,
      lock_fields_after_submit: JSON.stringify(['total'])
    });

    await db.getRawConnection()('sys_docfield').insert([
      { id: uuidv4(), tenant_id: TEST_TENANT, doctype_id: docId, fieldname: 'total', fieldtype: 'Int', is_required: true },
      { id: uuidv4(), tenant_id: TEST_TENANT, doctype_id: docId, fieldname: 'notes', fieldtype: 'Data', is_required: false }
    ]);

    // Setup Role & Permission for NORMAL_USER_ID
    const roleId = uuidv4();
    await db.getRawConnection()('sys_role').insert({ id: roleId, tenant_id: TEST_TENANT, name: 'Sales' });
    
    await db.getRawConnection()('sys_permission').insert({
      id: uuidv4(),
      tenant_id: TEST_TENANT,
      role_id: roleId,
      doctype: 'Invoice',
      can_read: true,
      can_write: true,
      can_create: true,
      can_submit: true,
      can_cancel: false // cannot cancel
    });

    await db.getRawConnection()('sys_user_role').insert({
      id: uuidv4(),
      tenant_id: TEST_TENANT,
      user_id: NORMAL_USER_ID,
      role_id: roleId
    });
  });

  it('System Manager can create and update freely', async () => {
    const res = await request(app)
      .post('/api/v1/doc/Invoice')
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', SYSTEM_MANAGER_ID) // default fallback is also System Manager
      .send({ total: 500 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Draft');
  });

  it('Normal User can create based on sys_permission', async () => {
    const res = await request(app)
      .post('/api/v1/doc/Invoice')
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID)
      .send({ total: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it('Normal User is rejected if no permission (e.g., delete)', async () => {
    // Insert doc first
    const docRes = await request(app)
      .post('/api/v1/doc/Invoice')
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID)
      .send({ total: 100 });

    const docId = docRes.body.data.id;

    // Attempt delete
    const delRes = await request(app)
      .delete(`/api/v1/doc/Invoice/${docId}`)
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID);

    expect(delRes.status).toBe(403);
    expect(delRes.body.error.message).toContain('User lacks permission to delete');
  });

  it('Lifecycle blocks update of Locked document', async () => {
    // 1. Create
    const docRes = await request(app)
      .post('/api/v1/doc/Invoice')
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID)
      .send({ total: 100 });
    const docId = docRes.body.data.id;

    // 2. Submit
    const subRes = await request(app)
      .post(`/api/v1/doc/Invoice/${docId}/submit`)
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID);
    
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.status).toBe('Locked'); // lock_on_submit = true

    // 3. Update should fail
    const updRes = await request(app)
      .put(`/api/v1/doc/Invoice/${docId}`)
      .set('x-tenant-id', TEST_TENANT)
      .set('x-user-id', NORMAL_USER_ID)
      .send({ total: 200 });

    expect(updRes.status).toBe(422); // Validation Error from Lifecycle
    expect(updRes.body.error.message).toContain('Cannot update document in status: Locked');
  });
});
