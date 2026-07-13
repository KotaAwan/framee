# 04-04 Module Loading

## Purpose

Documents how modules (business logic) are loaded into application memory at startup. Because Framee uses a dynamic architecture and supports a plugin system, the module loading mechanism must be deterministic and centralized.

---

## 1. Module vs Plugin

Framee distinguishes between **Modules** and **Plugins**:
- **Module**: Part of the core codebase (e.g., Auth, System, Audit). They are always loaded.
- **Plugin**: An external extension installed separately (e.g., HRIS, POS). They are loaded dynamically if enabled in the configuration.

---

## 2. Bootstrapping Flow (Startup Sequence)

When the backend (Node.js/Express) is started via `server.js`, the initialization order is critical to prevent dependency injection issues and undefined references.

```text
1. Load Environment Variables (dotenv)
2. Initialize Logger (Winston)
3. Initialize Database Connection (Knex)
4. Initialize Cache Connection (Redis)
5. Load Core Engines (Singleton instantiation)
   a. Event Engine
   b. Metadata Engine (fetches schema from DB -> Cache)
   c. Permission Engine
   d. CRUD Engine
   e. Document Lifecycle Engine
   f. Audit & Version Engines (Subscribe to Event Engine)
6. Load Built-in Modules (Service Layer)
7. Load Active Plugins (Scan plugin.json & register hooks)
8. Initialize API Router (Generate dynamic routes + register static routes)
9. Start Express Listener (app.listen)
```

---

## 3. Module Loader Implementation

The file `src/core/ModuleLoader.js` is responsible for reading the directory structure and loading services and event listeners.

### Service & Controller Registration
All modules must export an `init()` method or a specific structure from their `index.js`.

Example `src/modules/auth/index.js`:
```javascript
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthEvents } from './auth.events.js';

export default {
  name: 'AuthModule',
  init: (app, container) => {
    // Register service to DI container
    container.register('AuthService', new AuthService());
    
    // Register specific static routes
    const controller = new AuthController(container);
    app.post('/api/v1/auth/login', controller.login);
    
    // Register event listeners
    AuthEvents.register(container.get('EventEngine'));
  }
};
```

---

## 4. Metadata-First Rule

The system cannot perform routing or CRUD validation before Metadata is loaded.
Therefore:
1. `MetadataEngine.loadAll()` is called **before** the API Server accepts connections.
2. If the database is empty or the connection fails, the system throws a `FatalError` and crashes (Fail Fast).

---

## 5. Plugin Loading

Plugins are loaded after core modules.
1. The loader reads the list of active plugins from the DB (`sys_plugin` table) or `framee.config.json`.
2. Dynamically calls `import('plugin-name/backend')`.
3. Calls `plugin.init(app, container)` so the plugin can inject additional routes or register hooks into the Event Engine.

### Plugin Security
- Plugins operate within the same Node.js process (in-process).
- Plugins have access to the DI container (`container.get('DatabaseEngine')`).
- A malicious plugin can affect performance. Therefore, plugin installation must only be performed by the System Manager.
