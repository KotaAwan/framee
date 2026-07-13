# 04-07 Dynamic Routing

## Purpose

Documents how the API Router automatically registers and executes endpoints for every DocType in the system without requiring developers to write individual route files (like `customer.routes.js`) for each entity.

---

## 1. The Problem with Static Routing

In conventional frameworks, adding a "Product" table requires:
1. Create `product.controller.js`
2. Create `product.service.js`
3. Create `product.routes.js`
4. Register the route `app.use('/api/products', productRoutes)`

In an ERP with 100+ tables, this approach generates thousands of lines of identical boilerplate code (Create, Read, Update, Delete). Framee solves this with **Dynamic Routing**.

---

## 2. API Engine (Auto-Router)

The API Engine on the backend intercepts requests matching a specific URL pattern and dynamically parses the DocType name from it.

Primary URL Pattern:
`[METHOD] /api/v1/doc/:doctype/:id?`

### Route Definition in Express

Inside the API Engine, routes are registered using Express path parameters (`:doctype`):

```javascript
const router = express.Router();

// Middleware: Validate DocType exists
router.use('/:doctype', async (req, res, next) => {
  const doctype = req.params.doctype;
  const meta = await container.get('MetadataEngine').getDocMeta(doctype);
  if (!meta) return res.status(404).json({ error: 'DocType not found' });
  
  req.docMeta = meta; // Inject metadata into request
  next();
});

// GET List
router.get('/:doctype', GenericController.list);

// POST Create
router.post('/:doctype', GenericController.create);

// GET Single
router.get('/:doctype/:id', GenericController.get);

// PUT Update
router.put('/:doctype/:id', GenericController.update);

// DELETE Soft Delete
router.delete('/:doctype/:id', GenericController.delete);

// POST Lifecycle Actions
router.post('/:doctype/:id/:action(submit|lock|unlock|cancel|amend)', GenericController.lifecycle);
```

---

## 3. Generic Controller & Service Layer

`GenericController` contains zero business logic. It only:
1. Reads `req.params.doctype` and `req.docMeta`.
2. Reads `req.body` and `req.query`.
3. Calls `CRUDEngine`.
4. Returns the result in the standard JSON format.

Example execution of `GenericController.create`:
```javascript
async create(req, res, next) {
  try {
    const result = await CRUDEngine.create({
      doctype: req.params.doctype,
      meta: req.docMeta,
      data: req.body,
      user: req.user,
      tenantId: req.tenant.id
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error); // Forward to Error Handler
  }
}
```

---

## 4. Static / Custom Routes

Although 95% of operations are covered by dynamic routes, the system still supports custom routes for highly specific logic (e.g., Authentication, Payment Gateway Integration).

Custom routes are registered **before** dynamic routes in Express, so they are not overridden:

```javascript
// 1. Static Custom Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reports', reportRoutes);

// 2. Dynamic DocType Routes (Catch-all for entities)
app.use('/api/v1/doc', dynamicDocRoutes);
```

---

## 5. Security on Dynamic Routes

Because the generic route exposes the entire database (all DocTypes), security is enforced strictly inside `CRUDEngine`:

1. **Permission Engine** runs first. If a user tries `DELETE /api/v1/doc/SalesInvoice/123` but does not have `can_delete` rights for the `SalesInvoice` DocType, the request is rejected (403 Forbidden).
2. **Tenant Isolation** is enforced by the DB Layer. Data from other tenants will never be touched.
3. **DocType validation**: Only registered, active DocTypes (`is_active = 1`) can be accessed — not arbitrary table names.
