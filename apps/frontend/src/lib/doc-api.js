import api from './axios';

export const docApi = {
  /**
   * Get a list of records for a specific doctype
   * @param {string} doctype - The name of the doctype
   * @param {object} params - Query parameters (limit, offset, filters, etc.)
   */
  getList: async (doctype, params = {}) => {
    const res = await api.get(`/doc/${doctype}`, { params });
    return res.data;
  },

  /**
   * Get a single record by ID
   * @param {string} doctype - The name of the doctype
   * @param {string|number} id - The record ID
   */
  get: async (doctype, id) => {
    const res = await api.get(`/doc/${doctype}/${id}`);
    return res.data;
  },

  /**
   * Create a new record
   * @param {string} doctype - The name of the doctype
   * @param {object} data - The record data
   */
  create: async (doctype, data) => {
    const res = await api.post(`/doc/${doctype}`, data);
    return res.data;
  },

  /**
   * Update an existing record
   * @param {string} doctype - The name of the doctype
   * @param {string|number} id - The record ID
   * @param {object} data - The record data
   */
  update: async (doctype, id, data) => {
    const res = await api.put(`/doc/${doctype}/${id}`, data);
    return res.data;
  },

  /**
   * Soft delete a record
   * @param {string} doctype - The name of the doctype
   * @param {string|number} id - The record ID
   * @param {string} reason - Reason for deletion
   */
  delete: async (doctype, id, reason = '') => {
    const res = await api.delete(`/doc/${doctype}/${id}`, {
      data: { delete_reason: reason }
    });
    return res.data;
  },

  /**
   * Submit a document
   */
  submit: async (doctype, id) => {
    const res = await api.post(`/doc/${doctype}/${id}/submit`);
    return res.data;
  },

  /**
   * Cancel a document
   */
  cancel: async (doctype, id, reason = '') => {
    const res = await api.post(`/doc/${doctype}/${id}/cancel`, { cancel_reason: reason });
    return res.data;
  }
};
