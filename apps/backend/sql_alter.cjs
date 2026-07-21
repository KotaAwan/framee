const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'framee_dev' });
  try {
    // 1. Rename columns in sys_permission
    await conn.query('ALTER TABLE sys_permission CHANGE COLUMN can_write can_update BOOLEAN DEFAULT FALSE');
    await conn.query('ALTER TABLE sys_permission CHANGE COLUMN can_submit can_lock BOOLEAN DEFAULT FALSE');
    await conn.query('ALTER TABLE sys_permission CHANGE COLUMN can_cancel can_unlock BOOLEAN DEFAULT FALSE');

    // 2. Rename columns in sys_permission_version
    await conn.query('ALTER TABLE sys_permission_version CHANGE COLUMN can_write can_update BOOLEAN DEFAULT FALSE');
    await conn.query('ALTER TABLE sys_permission_version CHANGE COLUMN can_submit can_lock BOOLEAN DEFAULT FALSE');
    await conn.query('ALTER TABLE sys_permission_version CHANGE COLUMN can_cancel can_unlock BOOLEAN DEFAULT FALSE');

    // 3. Drop is_printable from sys_doctype and sys_doctype_version
    await conn.query('ALTER TABLE sys_doctype DROP COLUMN is_printable');
    await conn.query('ALTER TABLE sys_doctype_version DROP COLUMN is_printable');

    console.log('Database altered successfully!');
  } catch (err) {
    // If they already changed, it will throw an error, which is fine to log
    console.error('Migration notice:', err.message);
  } finally {
    conn.end();
  }
}
run();
