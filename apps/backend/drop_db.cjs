const knex = require('knex')(require('./knexfile.js').development);

async function run() {
  try {
    await knex.raw('DROP DATABASE IF EXISTS framee_dev');
    await knex.raw('CREATE DATABASE framee_dev');
    console.log('Database dropped and recreated.');
  } catch (err) {
    console.error(err);
  } finally {
    knex.destroy();
  }
}
run();
