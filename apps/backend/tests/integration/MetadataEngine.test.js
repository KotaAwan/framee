import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Container from '../../src/core/Container.js';
import DatabaseEngine from '../../src/core/DatabaseEngine/DatabaseEngine.js';
import CacheEngine from '../../src/core/CacheEngine/CacheEngine.js';
import MetadataEngine from '../../src/core/MetadataEngine/MetadataEngine.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_TENANT = uuidv4();

describe('MetadataEngine Integration', () => {
  beforeAll(async () => {
    // Initialize Engines
    await DatabaseEngine.init();
    await CacheEngine.init();

    // Register to Container
    Container.register('DatabaseEngine', DatabaseEngine);
    Container.register('CacheEngine', CacheEngine);

    MetadataEngine.init();
  });

  afterAll(async () => {
    await DatabaseEngine.close();
    await CacheEngine.close();
    Container.clear();
  });

  beforeEach(async () => {
    // Clean up cache
    await CacheEngine.del(`framee:meta:TestDoc`);
    await CacheEngine.del(`framee:meta:sys_doctype`);
    // Clean up DB
    await DatabaseEngine.getRawConnection()('sys_docfield').where('doctype', 'sys_testdoc').delete();
    await DatabaseEngine.getRawConnection()('sys_doctype').where('table_name', 'sys_testdoc').delete();
  });

  it('should fetch DocType from DB on cache miss and then populate cache', async () => {
    // Seed DB
    await DatabaseEngine.getRawConnection()('sys_doctype').insert({
      id: 9999,
      code: 'DOCT-TEST-0001',
      name: 'TestDoc',
      table_name: 'sys_testdoc',
      slug: 'TestDoc',
      status: 'Saved'
    });

    await DatabaseEngine.getRawConnection()('sys_docfield').insert({
      id: 9999,
      doctype: 'sys_testdoc',
      fieldname: 'test_field',
      fieldtype: 'Data',
      label: 'Test Field',
      sort_order: 1
    });

    // 1. Fetch from MetadataEngine (Cache Miss -> DB -> Cache Set)
    const meta1 = await MetadataEngine.getDocType('TestDoc');
    expect(meta1.name).toBe('TestDoc');
    expect(meta1.fields.length).toBe(1);
    expect(meta1.fields[0].fieldname).toBe('test_field');

    // 2. Verify it was written to Redis cache
    const cachedData = await CacheEngine.get(`framee:meta:TestDoc`);
    expect(cachedData).toBeDefined();
    expect(cachedData.name).toBe('TestDoc');

    // 3. Optional: we could mock DB to prove it doesn't hit DB on second call, 
    // but verifying cache has data is sufficient for now.
    const meta2 = await MetadataEngine.getDocType('TestDoc');
    expect(meta2.name).toBe('TestDoc');
  });

  it('should throw NotFoundError for unknown DocType', async () => {
    await expect(MetadataEngine.getDocType('UnknownDoc'))
      .rejects
      .toThrow('not found or inactive');
  });

  it('should invalidate cache correctly', async () => {
    // Manually set cache
    await CacheEngine.set(`framee:meta:TestDoc`, { name: 'TestDoc' });
    
    // Call invalidate
    await MetadataEngine.invalidate('TestDoc');
    
    // Verify it's gone
    const cached = await CacheEngine.get(`framee:meta:TestDoc`);
    expect(cached).toBeNull();
  });
});
