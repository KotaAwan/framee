import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse';
import fs from 'fs';
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
   * Export records of a doctype to CSV or XLSX
   * @param {string} doctype 
   * @param {object} filters 
   * @param {string} format 'csv' or 'xlsx'
   * @param {string} tenantId 
   * @param {string} userId 
   */
  async exportData(doctype, filters, format, tenantId, userId) {
    // 1. Fetch metadata to get fields
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    
    // We export all records (remove pagination limit)
    const exportFilters = { ...filters };
    delete exportFilters.limit;
    delete exportFilters.offset;
    delete exportFilters.page;
    delete exportFilters.pageSize;
    
    // 2. Fetch data
    const records = await this.crudEngine.getList(doctype, exportFilters, tenantId, userId);
    
    if (!records || records.length === 0) {
      throw new ValidationError('No records found to export.');
    }

    // 3. Determine columns to export (exclude system internal fields unless needed)
    const exportFields = meta.fields
      .filter(f => !f.is_hidden && f.fieldtype !== 'Table')
      .map(f => f.fieldname);
    
    // Add default system fields
    const columns = ['id', 'status', 'created_at', ...exportFields];

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
    } else {
      throw new ValidationError(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Process an imported CSV file
   * Note: In a production ERP, this should be sent to a Queue for background processing.
   * For simplicity here, we process synchronously.
   */
  async importData(doctype, filePath, tenantId, userId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    
    const results = [];
    const errors = [];
    let rowNum = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', async (row) => {
          rowNum++;
          // We push processing promises to an array or await sequentially
          // Using a simple array to process later to maintain order or simplify logic
          results.push(row);
        })
        .on('end', async () => {
          // Process all parsed rows
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
                await this.crudEngine.update(doctype, existingId, data, tenantId, userId);
              } else {
                // Insert new
                await this.crudEngine.insert(doctype, data, tenantId, userId);
              }
              successCount++;
            } catch (err) {
              errors.push({ row: i + 2, error: err.message }); // i+2 because header is 1, 0-indexed is 2
            }
          }
          
          // Clean up temp file
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
