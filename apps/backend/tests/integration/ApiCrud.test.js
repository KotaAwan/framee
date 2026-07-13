import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from '../../src/server.js';
import Container from '../../src/core/Container.js';
import DatabaseEngine from '../../src/core/DatabaseEngine/DatabaseEngine.js';

const TEST_TENANT = uuidv4();
let app;

describe('API & CRUD Engine E2E', () => {
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
    await cache.del(`framee:meta:${TEST_TENANT}:User`);
    await cache.del(`framee:meta:${TEST_TENANT}:__all_list`);
    
    // Clean up test tables
    await db.query('sys_docfield', TEST_TENANT, { includeDeleted: true }).delete();
    await db.query('sys_doctype', TEST_TENANT).delete();
    
    // Drop dynamic table if it exists
    await db.getRawConnection().schema.dropTableIfExists('dt_user');

    // Create dynamic table dt_user for testing
    await db.getRawConnection().schema.createTable('dt_user', (table) => {
      table.uuid('id').primary();
      table.uuid('tenant_id').notNullable();
      table.string('name', 100);
      table.integer('age');
      table.string('status', 50).defaultTo('Draft');
      table.uuid('created_by');
      table.uuid('updated_by');
      table.boolean('is_deleted').defaultTo(false);
      table.datetime('created_at');
      table.datetime('updated_at');
    });

    // Seed Metadata for 'User'
    const docId = uuidv4();
    await db.getRawConnection()('sys_doctype').insert({
      id: docId,
      tenant_id: TEST_TENANT,
      name: 'User',
      label: 'System User',
      is_active: true
    });

    await db.getRawConnection()('sys_docfield').insert([
      {
        id: uuidv4(),
        tenant_id: TEST_TENANT,
        doctype_id: docId,
        fieldname: 'name',
        fieldtype: 'Data',
        is_required: true,
        sort_order: 1
      },
      {
        id: uuidv4(),
        tenant_id: TEST_TENANT,
        doctype_id: docId,
        fieldname: 'age',
        fieldtype: 'Int',
        is_required: false,
        sort_order: 2
      }
    ]);
  });

  it('should create a document and return 201', async () => {
    const res = await request(app)
      .post('/api/v1/doc/User')
      .set('x-tenant-id', TEST_TENANT)
      .send({
        name: 'John Doe',
        age: 30
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('John Doe');
  });

  it('should return 422 ValidationError if required field is missing', async () => {
    const res = await request(app)
      .post('/api/v1/doc/User')
      .set('x-tenant-id', TEST_TENANT)
      .send({
        age: 30 // missing 'name'
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContain("Field 'name' is required.");
  });

  it('should retrieve a list of documents', async () => {
    // Insert first
    await request(app).post('/api/v1/doc/User').set('x-tenant-id', TEST_TENANT).send({ name: 'Alice' });
    await request(app).post('/api/v1/doc/User').set('x-tenant-id', TEST_TENANT).send({ name: 'Bob' });

    const res = await request(app)
      .get('/api/v1/doc/User')
      .set('x-tenant-id', TEST_TENANT);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
  });
});
