/**
 * A simple Singleton Dependency Injection Container.
 * Holds references to initialized Core Engines so they can access each other
 * without tight coupling or circular dependency issues.
 */
class Container {
  constructor() {
    this.services = new Map();
  }

  /**
   * Registers a service (engine) instance.
   * @param {string} name 
   * @param {object} instance 
   */
  register(name, instance) {
    if (this.services.has(name)) {
      throw new Error(`Service [${name}] is already registered.`);
    }
    this.services.set(name, instance);
  }

  /**
   * Retrieves a registered service.
   * @param {string} name 
   * @returns {object}
   */
  resolve(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service [${name}] is not registered in the Container.`);
    }
    return service;
  }

  /**
   * Clears all registered services. Useful for testing.
   */
  clear() {
    this.services.clear();
  }
}

// Export as a singleton
const containerInstance = new Container();
export default containerInstance;
