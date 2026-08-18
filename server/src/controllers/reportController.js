const reportService = require('../services/reportService');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');

function sanitizeForSpreadsheet(val) {
  if (typeof val === 'string' && /^[=+\-@\t\r%]/.test(val)) {
    return `'${val}`;
  }
  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.map(sanitizeForSpreadsheet);
    }
    const sanitized = {};
    for (const [k, v] of Object.entries(val)) {
      sanitized[k] = sanitizeForSpreadsheet(v);
    }
    return sanitized;
  }
  return val;
}

const reportController = {
  async companyDashboard(req, res, next) {
    try {
      const dashboard = await reportService.getCompanyDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  },

  async export(req, res, next) {
    try {
      const { type, format } = req.query;

      let data;
      let filename;
      switch (type) {
        case 'items':
          data = await reportService.exportItems();
          filename = 'items';
          break;
        case 'movements':
          data = await reportService.exportMovements();
          filename = 'movements';
          break;
        case 'requests':
          data = await reportService.exportRequests();
          filename = 'requests';
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid export type. Use: items, movements, requests' });
      }

      // Neutralize CSV Formula Injection across all exported records
      const sanitizedData = data.map(record => sanitizeForSpreadsheet(record));

      if (format === 'csv') {
        const parser = new Parser();
        const csv = parser.parse(sanitizedData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.csv"`);
        return res.send(csv);
      }

      if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(filename);

        if (sanitizedData.length > 0) {
          const columns = Object.keys(sanitizedData[0]).map(key => ({
            header: key, key, width: 20,
          }));
          worksheet.columns = columns;
          sanitizedData.forEach(row => worksheet.addRow(row));
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.xlsx"`);
        return workbook.xlsx.write(res);
      }

      res.status(400).json({ success: false, message: 'Invalid format. Use: csv, xlsx' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = reportController;
