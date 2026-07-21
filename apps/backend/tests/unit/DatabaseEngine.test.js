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

  it('should automatically filter out Deleted status by default', () => {
    const qb = DatabaseEngine.query('dt_customer');
    const sql = qb.toSQL().sql;
    
    expect(sql).toContain('not `status` = ?');
    expect(qb.toSQL().bindings[0]).toBe('Deleted');
  });

  it('should not filter out Deleted status if includeDeleted is true', () => {
    const qb = DatabaseEngine.query('dt_customer', { includeDeleted: true });
    const sql = qb.toSQL().sql;
    
    expect(sql).not.toContain('`status` = ?');
    expect(qb.toSQL().bindings.length).toBe(0);
  });

  it('should throw if engine is not initialized', () => {
    DatabaseEngine.db = null;
    expect(() => {
      DatabaseEngine.query('dt_customer');
    }).toThrow(DatabaseError);
  });
});
