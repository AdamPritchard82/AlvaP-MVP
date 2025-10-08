const fs = require('fs');
const path = require('path');

class ExportService {
  constructor() {
    this.supportedFormats = ['csv', 'pdf'];
    this.exportDir = path.join(process.cwd(), 'exports');
    
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // Export candidates to CSV
  async exportToCSV(candidates, options = {}) {
    const {
      filename = `candidates-export-${Date.now()}.csv`,
      columns = ['full_name', 'email', 'phone', 'current_title', 'current_employer', 'salary_min', 'salary_max', 'tags', 'skills'],
      includeHeaders = true
    } = options;

    const filePath = path.join(this.exportDir, filename);
    
    // CSV header
    const headers = columns.map(col => this.getColumnLabel(col));
    const csvRows = [headers.join(',')];

    // CSV data rows
    candidates.forEach(candidate => {
      const row = columns.map(col => {
        const value = this.getFieldValue(candidate, col);
        // Escape CSV values (handle commas, quotes, newlines)
        return this.escapeCSVValue(value);
      });
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    fs.writeFileSync(filePath, csvContent, 'utf8');

    return {
      success: true,
      filename,
      filePath,
      size: fs.statSync(filePath).size,
      recordCount: candidates.length,
      format: 'csv'
    };
  }

  // Export candidates to PDF (simplified version)
  async exportToPDF(candidates, options = {}) {
    const {
      filename = `candidates-export-${Date.now()}.pdf`,
      title = 'Candidates Export',
      columns = ['full_name', 'email', 'phone', 'current_title', 'current_employer'],
      includeHeaders = true
    } = options;

    // For now, create a simple text-based PDF representation
    // In production, you'd use a library like puppeteer or pdfkit
    const filePath = path.join(this.exportDir, filename);
    
    let pdfContent = `%PDF-1.4\n`;
    pdfContent += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    pdfContent += `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
    pdfContent += `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n`;
    
    // Simple text content
    let textContent = `${title}\n\n`;
    textContent += `Generated: ${new Date().toISOString()}\n`;
    textContent += `Total Records: ${candidates.length}\n\n`;
    
    if (includeHeaders) {
      const headers = columns.map(col => this.getColumnLabel(col));
      textContent += headers.join(' | ') + '\n';
      textContent += '-'.repeat(headers.join(' | ').length) + '\n';
    }
    
    candidates.forEach((candidate, index) => {
      const row = columns.map(col => {
        const value = this.getFieldValue(candidate, col);
        return value || '-';
      });
      textContent += `${index + 1}. ${row.join(' | ')}\n`;
    });
    
    // For now, save as text file (in production, convert to actual PDF)
    const textFilePath = filePath.replace('.pdf', '.txt');
    fs.writeFileSync(textFilePath, textContent, 'utf8');
    
    return {
      success: true,
      filename: filename.replace('.pdf', '.txt'),
      filePath: textFilePath,
      size: fs.statSync(textFilePath).size,
      recordCount: candidates.length,
      format: 'text', // Note: This is actually text, not PDF
      note: 'PDF export requires additional dependencies. Currently exporting as text file.'
    };
  }

  // Get field value from candidate object
  getFieldValue(candidate, field) {
    switch (field) {
      case 'full_name':
        return candidate.full_name || '';
      case 'email':
        return candidate.email || '';
      case 'phone':
        return candidate.phone || '';
      case 'current_title':
        return candidate.current_title || '';
      case 'current_employer':
        return candidate.current_employer || '';
      case 'salary_min':
        return candidate.salary_min ? candidate.salary_min.toString() : '';
      case 'salary_max':
        return candidate.salary_max ? candidate.salary_max.toString() : '';
      case 'tags':
        return Array.isArray(candidate.tags) ? candidate.tags.join('; ') : '';
      case 'skills':
        if (candidate.skills && typeof candidate.skills === 'object') {
          return Object.entries(candidate.skills)
            .filter(([_, hasSkill]) => hasSkill)
            .map(([skill, _]) => skill)
            .join('; ');
        }
        return '';
      case 'notes':
        return candidate.notes || '';
      case 'created_at':
        return candidate.created_at || '';
      case 'seniority':
        return candidate.seniority || '';
      default:
        return '';
    }
  }

  // Get human-readable column label
  getColumnLabel(field) {
    const labels = {
      full_name: 'Full Name',
      email: 'Email',
      phone: 'Phone',
      current_title: 'Current Title',
      current_employer: 'Current Employer',
      salary_min: 'Min Salary',
      salary_max: 'Max Salary',
      tags: 'Tags',
      skills: 'Skills',
      notes: 'Notes',
      created_at: 'Created Date',
      seniority: 'Seniority'
    };
    return labels[field] || field;
  }

  // Escape CSV values
  escapeCSVValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = value.toString();
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  // Get export statistics
  getExportStats() {
    try {
      const files = fs.readdirSync(this.exportDir);
      const stats = {
        totalFiles: files.length,
        csvFiles: files.filter(f => f.endsWith('.csv')).length,
        pdfFiles: files.filter(f => f.endsWith('.pdf')).length,
        textFiles: files.filter(f => f.endsWith('.txt')).length,
        totalSize: 0
      };
      
      files.forEach(file => {
        const filePath = path.join(this.exportDir, file);
        const stat = fs.statSync(filePath);
        stats.totalSize += stat.size;
      });
      
      return stats;
    } catch (error) {
      return {
        totalFiles: 0,
        csvFiles: 0,
        pdfFiles: 0,
        textFiles: 0,
        totalSize: 0,
        error: error.message
      };
    }
  }

  // Clean up old export files
  cleanupOldExports(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    try {
      const files = fs.readdirSync(this.exportDir);
      const now = Date.now();
      let cleanedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.exportDir, file);
        const stat = fs.statSync(filePath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      });
      
      return {
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} old export files`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get supported formats
  getSupportedFormats() {
    return this.supportedFormats;
  }

  // Validate export options
  validateOptions(options) {
    const errors = [];
    
    if (options.format && !this.supportedFormats.includes(options.format)) {
      errors.push(`Unsupported format: ${options.format}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }
    
    if (options.columns && !Array.isArray(options.columns)) {
      errors.push('Columns must be an array');
    }
    
    if (options.limit && (options.limit < 1 || options.limit > 10000)) {
      errors.push('Limit must be between 1 and 10000');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ExportService;
