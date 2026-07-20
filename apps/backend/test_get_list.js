import Container from './src/core/Container.js';
import bootstrap from './src/bootstrap.js';

async function run() {
  await bootstrap();
  const crud = Container.resolve('CRUDEngine');
  const records = await crud.getList('sys_user', {}, 'system', 1);
  console.log(JSON.stringify(records, null, 2));
  process.exit(0);
}
run().catch(console.error);
