# 04-08 Dependency Injection

## Purpose

Documents how Dependency Injection (DI) is applied in the Framee backend. DI is critical for avoiding tight coupling between classes/engines, simplifying unit testing, and allowing plugins to replace built-in components.

---

## 1. Core Concept

Rather than having an engine or service statically require its dependencies (`import db from './database'`), dependencies are "injected" through a Container.

Framee uses a simple DI Container (such as Awilix or a custom implementation) that stores and initializes all Singletons.

---

## 2. DI Container

At application startup, a global `Container` is created:

```javascript
import { Container } from 'framee-core';
import DatabaseEngine from './core/DatabaseEngine.js';
import MetadataEngine from './core/MetadataEngine.js';
import EventEngine from './core/EventEngine.js';

const container = new Container();

// Register Core Engines
container.register('DatabaseEngine', new DatabaseEngine());
container.register('EventEngine', new EventEngine());

// MetadataEngine needs DB and Event, so they are injected via constructor
container.register('MetadataEngine', new MetadataEngine({
  db: container.get('DatabaseEngine'),
  events: container.get('EventEngine')
}));
```

---

## 3. Automatic Resolution

Engines or services do not look up their own dependencies; the DI Container delivers them:

```javascript
class CRUDEngine {
  constructor({ DatabaseEngine, MetadataEngine, EventEngine, DocumentLifecycleEngine }) {
    this.db = DatabaseEngine;
    this.meta = MetadataEngine;
    this.events = EventEngine;
    this.lifecycle = DocumentLifecycleEngine;
  }
  
  // CRUD logic methods...
}
```

---

## 4. Benefits for Plugins

With the DI Container, if a plugin wants to replace the default behavior of a built-in service, it can override the registration in the container (as long as the component is designed to be overridable).

Example: A plugin wants to send notification emails using AWS SES instead of the default SMTP.
```javascript
// Inside plugin.init()
container.register('EmailService', new AwsSesEmailService(), { overwrite: true });
```
All modules that request `EmailService` will now receive the AWS SES instance.

---

## 5. Usage in Controllers / Express Middleware

Because Express middleware is not created through a class constructor, we attach the container to the `req` object (Request) at the beginning of the pipeline, or retrieve it from a global registry.

```javascript
// Middleware
app.use((req, res, next) => {
  req.container = globalContainer;
  next();
});

// Inside GenericController
async create(req, res, next) {
  const crudEngine = req.container.get('CRUDEngine');
  // ...
}
```
