import { config } from './src/config/env.js';
import DatabaseEngine from './src/core/DatabaseEngine/DatabaseEngine.js';
import Container from './src/core/Container.js';
import CacheEngine from './src/core/CacheEngine/CacheEngine.js';
import MetadataEngine from './src/core/MetadataEngine/MetadataEngine.js';
import LifecycleEngine from './src/core/LifecycleEngine/LifecycleEngine.js';
import EventEngine from './src/core/EventEngine/EventEngine.js';
import WorkflowEngine from './src/core/WorkflowEngine/WorkflowEngine.js';
import NamingEngine from './src/core/NamingEngine/NamingEngine.js';
import CRUDEngine from './src/core/CRUDEngine/CRUDEngine.js';

async function run() {
  DatabaseEngine.init();
  Container.register('DatabaseEngine', DatabaseEngine);
  
  await CacheEngine.init();
  Container.register('CacheEngine', CacheEngine);
  
  MetadataEngine.init();
  Container.register('MetadataEngine', MetadataEngine);

  LifecycleEngine.init();
  Container.register('LifecycleEngine', LifecycleEngine);
  
  EventEngine.init();
  Container.register('EventEngine', EventEngine);

  WorkflowEngine.init();
  Container.register('WorkflowEngine', WorkflowEngine);

  NamingEngine.init();
  Container.register('NamingEngine', NamingEngine);

  CRUDEngine.init();
  Container.register('CRUDEngine', CRUDEngine);

  try {
    const list = await CRUDEngine.getList('sys_user', {}, '2607-00001', 'system');
    console.log("Success! Users fetched:", list.length);
  } catch (err) {
    console.error("Error fetching users:", err);
  }

  process.exit(0);
}

run();
