import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { logger } from '../../utils/logger.js';
import Container from '../Container.js';
import { NotFoundError, FrameeError } from '../../utils/errors.js';

class PrintEngine {
  constructor() {
    this.dbEngine = null;
    this.crudEngine = null;
  }

  init() {
    logger.info('Initializing Print Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.crudEngine = Container.resolve('CRUDEngine');
    
    // Register Handlebars helpers
    Handlebars.registerHelper('formatDate', (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString();
    });
    
    Handlebars.registerHelper('formatCurrency', (amount) => {
      if (!amount) return '0.00';
      return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }

  /**
   * Fetch the active print format for a given DocType.
   */
  async _getPrintFormat(doctype, formatName = null) {
    const query = this.dbEngine.query('sys_print_format')
      .where({ doctype_name: doctype, is_active: true });

    if (formatName) {
      query.andWhere({ name: formatName });
    } else {
      query.andWhere({ is_default: true });
    }

    const format = await query.first();
    
    // If no explicit default, get the first one available
    if (!format && !formatName) {
      return await this.dbEngine.query('sys_print_format')
        .where({ doctype_name: doctype, is_active: true })
        .first();
    }
    
    return format;
  }

  /**
   * Generates HTML from a Document and its Print Format.
   */
  async renderHtml(doctype, id, userId, formatName = null) {
    // 1. Get data
    const docData = await this.crudEngine.get(doctype, id, userId);
    
    // 2. Get format
    const format = await this._getPrintFormat(doctype, formatName);
    
    if (!format) {
      return this._generateFallbackHtml(doctype, docData);
    }
    
    // 3. Compile template
    try {
      const template = Handlebars.compile(format.html_template);
      return template({ doc: docData });
    } catch (err) {
      logger.error(`Error compiling print format ${format.name}:`, err);
      throw new FrameeError('PRINT_TEMPLATE_ERROR', 'Failed to compile print template.');
    }
  }

  /**
   * Generates a simple fallback HTML if no template is defined.
   */
  _generateFallbackHtml(doctype, docData) {
    let rows = '';
    for (const [key, value] of Object.entries(docData)) {
      if (typeof value === 'object' && value !== null) {
        continue;
      }
      rows += `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${key}</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${value !== null ? value : ''}</td></tr>`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${doctype} - ${docData.name || docData.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          h1 { color: #2563eb; }
        </style>
      </head>
      <body>
        <h1>${doctype}</h1>
        <table>${rows}</table>
      </body>
      </html>
    `;
  }

  /**
   * Generates a PDF buffer from HTML.
   */
  async renderPdf(doctype, id, userId, formatName = null) {
    const html = await this.renderHtml(doctype, id, userId, formatName);
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      return pdfBuffer;
    } catch (err) {
      logger.error('Failed to generate PDF with Puppeteer:', err);
      throw new FrameeError('PDF_GENERATION_FAILED', 'Failed to generate PDF document.');
    } finally {
      if (browser) await browser.close();
    }
  }
}

const instance = new PrintEngine();
export default instance;
