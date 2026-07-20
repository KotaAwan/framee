import knexConfig from './knexfile.js';
import Knex from 'knex';

const knex = Knex(knexConfig.default || knexConfig);

async function run() {
  try {
    const cols = await knex('sys_doctype').columnInfo();
    console.log(Object.keys(cols));
  } catch (err) {
    console.error(err);
  } finally {
    await knex.destroy();
  }
}
run();
