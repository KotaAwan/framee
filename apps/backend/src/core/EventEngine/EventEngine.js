import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
import DatabaseEngine from '../DatabaseEngine/DatabaseEngine.js';
import { config } from '../../config/env.js';

class EventEngine {
  constructor() {
    this.subscribers = new Map();
    this.logQueue = [];
    this.isFlushing = false;
    this.flushInterval = null;
  }

  /**
   * Initializes the Event Engine.
   */
  async init() {
    logger.info('Initializing Event Engine...');
    
    // Start background flusher for event logs
    this.flushInterval = setInterval(() => this._flushLogs(), 100);
    
    // Log self initialization
    await this.emit('event_engine.ready', { subscriber_count: 0 });
    logger.info('Event Engine initialized successfully.');
  }

  /**
   * Registers a subscriber for an event.
   * @param {string} eventName 
   * @param {function} handler 
   * @param {object} options 
   */
  on(eventName, handler, options = { priority: 10 }) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for event ${eventName} must be a function.`);
    }

    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    const handlers = this.subscribers.get(eventName);
    handlers.push({ handler, priority: options.priority || 10 });
    
    // Sort handlers by priority (lower number = higher priority)
    handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregisters a subscriber from an event.
   * @param {string} eventName 
   * @param {function} handler 
   */
  off(eventName, handler) {
    if (!this.subscribers.has(eventName)) return;

    const handlers = this.subscribers.get(eventName);
    const updatedHandlers = handlers.filter(h => h.handler !== handler);

    if (updatedHandlers.length === 0) {
      this.subscribers.delete(eventName);
    } else {
      this.subscribers.set(eventName, updatedHandlers);
    }
  }

  /**
   * Emits an event to all subscribers.
   * @param {string} eventName 
   * @param {object} payload 
   * @param {object} context (Optional context like tenant_id, user_id)
   */
  async emit(eventName, payload = {}, context = {}) {
    const isBeforeEvent = eventName.includes('.before_');
    const matchedHandlers = this._getMatchedHandlers(eventName);
    
    const startTime = Date.now();
    let hadErrors = false;
    let cancelled = false;
    let errors = [];

    if (matchedHandlers.length > 0) {
      if (isBeforeEvent) {
        // Sequential, blocking, cancellable
        for (const { handler } of matchedHandlers) {
          try {
            await handler(payload, context);
          } catch (err) {
            hadErrors = true;
            cancelled = true;
            errors.push(err);
            logger.warn(`Event ${eventName} cancelled by handler: ${err.message}`);
            // Bubble up the error to cancel the operation
            throw err;
          }
        }
      } else {
        // Parallel, isolated, non-blocking
        const promises = matchedHandlers.map(({ handler }) => {
          return Promise.resolve(handler(payload, context)).catch(err => {
            logger.error(`Error in handler for event ${eventName}:`, err);
            return { error: err };
          });
        });

        const results = await Promise.allSettled(promises);
        hadErrors = results.some(r => r.status === 'fulfilled' && r.value && r.value.error);
        
        if (hadErrors) {
          errors = results.filter(r => r.status === 'fulfilled' && r.value && r.value.error).map(r => r.value.error);
          this.emit('event_engine.handler_error', { event: eventName, error_message: errors.map(e => e.message).join(', ') });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Queue log for async writing
    this.logQueue.push({
      id: randomUUID(),
      tenant_id: context.tenant_id || 'system',
      event_name: eventName,
      publisher: context.publisher || 'system',
      payload_summary: this._summarizePayload(payload),
      subscriber_count: matchedHandlers.length,
      user_id: context.user_id || null,
      doc_id: context.doc_id || null,
      doctype: context.doctype || null,
      duration_ms: durationMs,
      had_errors: hadErrors,
      created_at: new Date()
    });

    return { cancelled, errors };
  }

  /**
   * Checks if there are listeners for an event.
   * @param {string} eventName 
   * @returns {boolean}
   */
  hasListeners(eventName) {
    return this._getMatchedHandlers(eventName).length > 0;
  }

  /**
   * Lists all registered events.
   * @returns {Array}
   */
  listEvents() {
    const list = [];
    for (const [event, handlers] of this.subscribers.entries()) {
      list.push({
        event,
        subscriberCount: handlers.length
      });
    }
    return list;
  }

  /**
   * Gracefully close the engine.
   */
  close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining logs
    this._flushLogs();
    logger.info('Event Engine closed.');
  }

  // --- Private Methods ---

  /**
   * Finds all handlers that match the event name, including wildcards.
   * @param {string} eventName 
   * @returns {Array} Array of handler objects { handler, priority }
   */
  _getMatchedHandlers(eventName) {
    let matched = [];
    
    for (const [pattern, handlers] of this.subscribers.entries()) {
      if (this._matchPattern(pattern, eventName)) {
        matched = matched.concat(handlers);
      }
    }
    
    // Re-sort matched handlers by priority
    matched.sort((a, b) => a.priority - b.priority);
    return matched;
  }

  /**
   * Simple glob-style pattern matching (e.g., *.after_insert or Customer.*)
   * @param {string} pattern 
   * @param {string} str 
   * @returns {boolean}
   */
  _matchPattern(pattern, str) {
    if (pattern === str) return true;
    if (pattern.includes('*')) {
      const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      const regex = new RegExp(regexStr);
      return regex.test(str);
    }
    return false;
  }

  /**
   * Flushes logs to the database in batches.
   */
  async _flushLogs() {
    if (this.isFlushing || this.logQueue.length === 0) return;
    
    const knex = DatabaseEngine.getRawConnection();
    if (!knex) return; // DB not ready yet

    this.isFlushing = true;
    
    // Take a batch up to 50
    const batch = this.logQueue.splice(0, 50);

    try {
      await knex('sys_event_log').insert(batch);
    } catch (err) {
      logger.error('Failed to flush event logs to database:', err);
      // Re-queue the failed logs if it's not a fatal error
      // this.logQueue.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Summarizes the payload to prevent storing large objects or PII.
   * @param {object} payload 
   * @returns {string} JSON string summary
   */
  _summarizePayload(payload) {
    try {
      // Basic truncation
      const str = JSON.stringify(payload);
      const maxBytes = 1024;
      if (str && str.length > maxBytes) {
        return str.substring(0, maxBytes) + '... (truncated)';
      }
      return str;
    } catch (err) {
      return '{"error": "Unserializable payload"}';
    }
  }
}

const instance = new EventEngine();
export default instance;
