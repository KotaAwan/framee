import knexConfig from './knexfile.js';
import Knex from 'knex';

const knex = Knex(knexConfig.default || knexConfig);

async function run() {
  try {
    const rows = await knex('knex_migrations').select('*');
    console.log(rows.map(r => r.name));
  } catch (err) {
    console.error(err);
  } finally {
    await knex.destroy();
  }
}
run();
