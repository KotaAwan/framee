import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger.js';
import Container from '../Container.js';
import { FrameeError, ValidationError } from '../../utils/errors.js';

class DataEngine {
  constructor() {
    this.crudEngine = null;
    this.metaEngine = null;
  }

  init() {
    logger.info('Initializing Data Engine...');
    this.crudEngine = Container.resolve('CRUDEngine');
    this.metaEngine = Container.resolve('MetadataEngine');
  }

  /**
   * Export records of a doctype to CSV, XLSX, or PDF
   * @param {string} doctype 
   * @param {object} filters 
   * @param {string} format 'csv', 'xlsx', or 'pdf'
   * @param {string} userId 
   */
  async exportData(doctype, filters, format, userId) {
    // 1. Fetch metadata to get fields
    const meta = await this.metaEngine.getDocType(doctype);
    
    // We export all records (remove pagination limit)
    const exportFilters = { ...filters };
    delete exportFilters.limit;
    delete exportFilters.offset;
    delete exportFilters.page;
    delete exportFilters.pageSize;
    
    // 2. Fetch data
    const records = await this.crudEngine.getList(doctype, exportFilters, userId);
    
    if (!records || records.length === 0) {
      throw new ValidationError('No records found to export.');
    }

    // 3. Determine columns to export
    const sensitiveFields = ['password', 'password_hash', 'pin', 'pin_hash', 'google_id', 'avatar_url', 'is_deleted'];
    
    const exportFields = meta.fields
      .filter(f => !f.is_hidden && f.fieldtype !== 'Table' && !sensitiveFields.includes(f.fieldname) && f.fieldname !== 'id')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(f => f.fieldname);
    
    // Always prepend 'id' column as the primary identifier
    const columns = ['id', ...exportFields];

    // Format records to stringify objects for safe export
    const formattedRecords = records.map(record => {
      const newRecord = { ...record };
      for (const key in newRecord) {
        if (newRecord[key] !== null && typeof newRecord[key] === 'object') {
          newRecord[key] = JSON.stringify(newRecord[key]);
        }
      }
      return newRecord;
    });

    // 4. Generate Format
    if (format === 'csv') {
      try {
        const parser = new Parser({ fields: columns });
        const csv = parser.parse(formattedRecords);
        return { buffer: Buffer.from(csv, 'utf8'), contentType: 'text/csv', extension: 'csv' };
      } catch (err) {
        logger.error(`CSV Export Error:`, err);
        throw new FrameeError('EXPORT_FAILED', 'Failed to generate CSV data.');
      }
    } else if (format === 'xlsx') {
      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(doctype);
        
        // Define columns
        worksheet.columns = columns.map(col => ({ header: col, key: col, width: 20 }));
        
        // Add Rows
        formattedRecords.forEach(row => {
          worksheet.addRow(row);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
      } catch (err) {
        logger.error(`Excel Export Error:`, err);
        throw new FrameeError('EXPORT_FAILED', 'Failed to generate Excel data.');
      }
    } else if (format === 'pdf') {
      let browser;
      try {
        // Generate a standard tabular HTML representation of the list
        const formattedTitle = meta.label || meta.name || doctype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const headersHtml = columns.map(col => {
          const fieldMeta = meta.fields.find(f => f.fieldname === col);
          const label = fieldMeta?.label || (col === 'id' ? 'ID' : col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
          return `<th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: left; background-color: #f3f4f6; color: #374151; font-weight: 600; font-size: 12px;">${label}</th>`;
        }).join('');

        const rowsHtml = records.map(row => {
          const colsHtml = columns.map(col => {
            let val = row[col];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            if (col === 'created_at' && val) val = new Date(val).toLocaleString();
            return `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #4b5563; word-break: break-all;">${val}</td>`;
          }).join('');
          return `<tr>${colsHtml}</tr>`;
        }).join('');

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${formattedTitle} Export</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1f2937; }
              header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
              h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0; }
              span.meta { font-size: 12px; color: #6b7280; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            </style>
          </head>
          <body>
            <header>
              <h1>List of ${formattedTitle}</h1>
              <span class="meta">Exported on ${new Date().toLocaleString()} | Total Records: ${records.length}</span>
            </header>
            <table>
              <thead>
                <tr>${headersHtml}</tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </body>
          </html>
        `;

        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });
        
        return { buffer: Buffer.from(pdfBuffer), contentType: 'application/pdf', extension: 'pdf' };
      } catch (err) {
        logger.error(`PDF Export Error:`, err);
        throw new FrameeError('EXPORT_FAILED', 'Failed to generate PDF list data.');
      } finally {
        if (browser) await browser.close();
      }
    } else {
      throw new ValidationError(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Process an imported CSV file
   */
  async importData(doctype, filePath, userId) {
    const meta = await this.metaEngine.getDocType(doctype);
    
    const results = [];
    const errors = [];
    let rowNum = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', async (row) => {
          rowNum++;
          results.push(row);
        })
        .on('end', async () => {
          logger.info(`Parsed ${results.length} rows for import into ${doctype}. Processing...`);
          
          let successCount = 0;
          for (let i = 0; i < results.length; i++) {
            const data = results[i];
            
            // Clean data: remove empty fields
            Object.keys(data).forEach(key => {
              if (data[key] === '') {
                delete data[key];
              }
            });

            try {
              if (data.id) {
                // Update existing
                const existingId = data.id;
                delete data.id;
                await this.crudEngine.update(doctype, existingId, data, userId);
              } else {
                // Insert new
                await this.crudEngine.insert(doctype, data, userId);
              }
              successCount++;
            } catch (err) {
              errors.push({ row: i + 2, error: err.message });
            }
          }
          
          fs.unlink(filePath, () => {});
          
          resolve({
            success: true,
            total: results.length,
            imported: successCount,
            failed: errors.length,
            errors
          });
        })
        .on('error', (err) => {
          fs.unlink(filePath, () => {});
          reject(new FrameeError('IMPORT_FAILED', `Failed to read CSV file: ${err.message}`));
        });
    });
  }
}

const instance = new DataEngine();
export default instance;
