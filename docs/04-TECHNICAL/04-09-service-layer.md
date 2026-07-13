# 04-09 Service Layer

## Purpose

Documents the Service Layer pattern in Framee. The service layer holds **business logic** that is too specific or complex to be placed in the generic `CRUDEngine`.

---

## 1. CRUDEngine vs Service Layer

- **CRUDEngine**: Handles 95% of standard operations (save to database, read data, validate JSON schema, run lifecycle events). It does not care about the business domain (whether it's an Invoice or an Employee).
- **Service Layer**: Handles specific business logic. Examples: calculating monthly asset depreciation, processing subscription paywalls, synchronizing stock across warehouses.

---

## 2. Service Layer Characteristics

1. **Stateless**: Must not store state (instance variables) between requests. All data must be passed through parameters.
2. **HTTP-agnostic**: Services must not accept `req` or `res` objects. They only accept plain JS objects (`payload`, `userContext`, `tenantId`). This ensures services can be called by Cron Jobs, WebSockets, or unit tests.
3. **Uses Dependency Injection**: Services receive Repositories or other services through their constructor.

---

## 3. Implementation Example

```javascript
export class InventoryService {
  constructor({ ItemRepository, StockLedgerRepository, EventEngine }) {
    this.itemRepo = ItemRepository;
    this.ledgerRepo = StockLedgerRepository;
    this.events = EventEngine;
  }

  async processStockTransfer(tenantId, payload, userContext) {
    // 1. Domain-specific business validation (beyond metadata schema)
    const sourceStock = await this.ledgerRepo.getCurrentStock(
      tenantId, payload.item_code, payload.source_warehouse
    );
    if (sourceStock < payload.qty) {
      throw new BusinessError("Insufficient stock at the source warehouse.");
    }

    // 2. Database transaction (via repo)
    await this.ledgerRepo.transaction(async (trx) => {
      // Deduct from source
      await this.ledgerRepo.deduct(tenantId, payload.item_code, payload.source_warehouse, payload.qty, trx);
      // Add to target
      await this.ledgerRepo.add(tenantId, payload.item_code, payload.target_warehouse, payload.qty, trx);
    });

    // 3. Emit event for other modules (e.g., manager notification)
    this.events.emitAsync('Inventory.stock_transferred', { tenantId, payload });

    return { success: true };
  }
}
```

---

## 4. When to Use a Service?

1. When an action involves more than one DocType and requires an explicit, complex ACID transaction.
2. When the operation is not pure CRUD (e.g., Calculate Taxes, Generate PDF, Call External API).
3. When the business logic needs to run as a background job or via CLI.

**Do NOT use a Service if:**
- The operation is just a standard Create/Read/Update/Delete on a single table. Use `CRUDEngine` via the standard REST API instead.
