# 04-12 Queue Strategy

## Purpose

Documents how Framee processes heavy tasks in the background (Background Jobs) using a Redis-based Queue. This strategy is critical to prevent HTTP requests from blocking the Node.js Main Thread.

---

## 1. Background Job Concept

Whenever a task takes a long time (more than 500ms) or requires access to a third-party network, that task **must** be delegated to the Background Queue.

Example Jobs:
1. Sending Emails (SendGrid / SMTP)
2. Large-scale CSV data Export/Import
3. Writing Audit Logs to the Database
4. Generating PDF files from Invoices
5. Webhook calls to external systems

---

## 2. Queue Infrastructure (BullMQ)

Framee uses **BullMQ** (or a compatible Redis library) as its queue engine.

1. **Producer**: The part of the application (e.g., Event Engine or API) that enqueues a job.
2. **Redis**: Stores jobs, their status, and retry counters.
3. **Worker**: A process (can be in the same pod or a separate pod) that picks up jobs from the queue and executes them.

---

## 3. Queue Names

Framee separates queues by priority and task type:

| Queue Name | Priority | Use Case |
|------------|----------|----------|
| `framee:q:audit` | Very High | Writing audit logs to DB. Must be fast and reliable — never lost. |
| `framee:q:email` | Medium | Sending transactional emails. |
| `framee:q:export` | Low | Exporting CSV/PDF data requested by users (long-running). |
| `framee:q:webhook` | Low | Sending data to third-party APIs (prone to timeouts/failures). |

---

## 4. Retry & Dead Letter Mechanism

Because background jobs are prone to failure (e.g., the SMTP server is down), queues must be configured for automatic retry.

**Framee's Standard BullMQ Retry Config:**
- Max Attempts: 3
- Backoff Strategy: Exponential (e.g., first failure: wait 5s, second: 25s, third: 125s).
- **Dead Letter Queue (DLQ)**: If a job still fails after 3 attempts, it is moved to `Failed` status (or DLQ) for manual investigation by an administrator. Never delete failed jobs.

---

## 5. Enqueuing a Job (Producer)

How does a Service call the Queue? Through Dependency Injection.

```javascript
// Inside DocumentLifecycleEngine.js
class DocumentLifecycleEngine {
  async submitDocument(doc) {
    // 1. Update DB (Sync)
    await this.updateStatus(doc.id, 'Submitted');
    
    // 2. Delegate Email to Queue (Async)
    const emailQueue = this.container.get('EmailQueue');
    await emailQueue.add('sendSubmitNotification', {
      to: doc.owner_email,
      docId: doc.id
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
  }
}
```

---

## 6. Worker Execution

In production, it is recommended to run Workers in a separate process from the API Server so that 100% CPU usage by a Worker (e.g., when generating PDFs) does not slow down the API Server.

However, at small scale, Workers can be spawned within the same Node.js process during application initialization.
