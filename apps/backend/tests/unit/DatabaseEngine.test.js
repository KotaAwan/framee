import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseEngine from '../../src/core/DatabaseEngine/DatabaseEngine.js';
import { DatabaseError } from '../../src/utils/errors.js';
import knex from 'knex';

describe('DatabaseEngine', () => {
  beforeEach(() => {
    // For unit testing the query builder logic without a real DB connection,
    // we initialize a mock knex instance with a dummy client.
    DatabaseEngine.db = knex({ client: 'mysql2' });
  });

  it('should automatically apply tenant_id filter to all queries', () => {
    const qb = DatabaseEngine.query('dt_customer', 'tenant-1');
    const sql = qb.toSQL().sql;
    
    // Check that tenant_id is in the where clause
    expect(sql).toContain('`tenant_id` = ?');
    expect(qb.toSQL().bindings[0]).toBe('tenant-1');
  });

  it('should throw if tenant_id is missing', () => {
    expect(() => {
      DatabaseEngine.query('dt_customer', null);
    }).toThrow(DatabaseError);
  });

  it('should automatically filter out Deleted status', () => {
    const qb = DatabaseEngine.query('dt_customer', 'tenant-1');
    const sql = qb.toSQL().sql;
    
    expect(sql).toContain('not `status` = ?');
    expect(qb.toSQL().bindings[1]).toBe('Deleted');
  });

  it('should not filter out Deleted status if includeDeleted is true', () => {
    const qb = DatabaseEngine.query('dt_customer', 'tenant-1', { includeDeleted: true });
    const sql = qb.toSQL().sql;
    
    expect(sql).not.toContain('`status` != ?');
    // Only binding should be tenant-1
    expect(qb.toSQL().bindings.length).toBe(1);
  });

  it('should throw if engine is not initialized', () => {
    DatabaseEngine.db = null;
    expect(() => {
      DatabaseEngine.query('dt_customer', 'tenant-1');
    }).toThrow(DatabaseError);
  });
});
