import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface CSVImportProps {
  onImportComplete: () => void;
  onClose: () => void;
}

interface ImportPreview {
  success: boolean;
  preview: any[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: any[];
  fileId: string;
  headers: string[];
}

export default function CSVImport({ onImportComplete, onClose }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Canonical field names for mapping
  const canonicalFields = {
    firstName: 'First Name',
    lastName: 'Last Name', 
    email: 'Email',
    phone: 'Phone',
    currentTitle: 'Current Title',
    currentEmployer: 'Current Employer',
    salaryMin: 'Salary Min',
    salaryMax: 'Salary Max',
    seniority: 'Seniority',
    tags: 'Tags',
    notes: 'Notes',
    communications: 'Communications',
    campaigns: 'Campaigns',
    policy: 'Policy',
    publicAffairs: 'Public Affairs'
  };

  // Helper function for fuzzy matching
  const fuzzyMatch = (target: string, options: string[]): string | null => {
    const normalizedTarget = target.toLowerCase().replace(/[_\s-]+/g, ' ');
    
    // Exact match first
    for (const option of options) {
      if (option.toLowerCase().replace(/[_\s-]+/g, ' ') === normalizedTarget) {
        return option;
      }
    }
    
    // Partial match
    for (const option of options) {
      const normalizedOption = option.toLowerCase().replace(/[_\s-]+/g, ' ');
      if (normalizedOption.includes(normalizedTarget) || normalizedTarget.includes(normalizedOption)) {
        return option;
      }
    }
    
    return null;
  };

  // Auto-map columns based on fuzzy matching
  const autoMapColumns = (headers: string[]) => {
    const autoMapping: Record<string, string> = {};
    
    Object.entries(canonicalFields).forEach(([fieldKey, fieldName]) => {
      const match = fuzzyMatch(fieldName, headers);
      if (match) {
        autoMapping[fieldKey] = match;
      }
    });
    
    return autoMapping;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const result = await api.previewCSVImport(selectedFile);
      setPreview(result);
      
      // Auto-map columns based on headers
      const autoMapping = autoMapColumns(result.headers || []);
      setMapping(autoMapping);
    } catch (error) {
      console.error('Error previewing CSV:', error);
      toast.error('Failed to process CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    try {
      const result = await api.commitCSVImport(preview.fileId, mapping);
      
      if (result.success) {
        const message = result.errorDetails && result.errorDetails.length > 0 
          ? `Successfully imported ${result.imported} candidates (${result.errors} rows had errors)`
          : `Successfully imported ${result.imported} candidates`;
        toast.success(message);
        onImportComplete();
        onClose();
      } else {
        toast.error(`Import failed: ${result.errors} errors`);
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import candidates');
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorCSV = () => {
    if (!preview?.errors.length) return;

    const csvContent = [
      'Row,Errors,Data',
      ...preview.errors.map(error => 
        `${error.row},"${error.errors.join('; ')}","${JSON.stringify(error.data).replace(/"/g, '""')}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Import Candidates from CSV</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!preview ? (
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="csv-upload"
                    className={`cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600">
                      {loading ? 'Processing...' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">CSV files only</p>
                  </label>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Expected CSV Format</h3>
                <p className="text-sm text-blue-700 mb-2">
                  Your CSV should include columns for: <strong>First Name</strong> (required), <strong>Last Name</strong> (required), 
                  Email (optional), Phone, Current Title, Current Employer, Salary Min, Salary Max, Seniority, Tags, Notes, 
                  and skill columns (Communications, Campaigns, Policy, Public Affairs).
                </p>
                <div className="text-xs text-blue-600 space-y-1">
                  <p><strong>Skills:</strong> Use "x" or "X" to indicate the candidate has that skill, leave blank otherwise.</p>
                  <p><strong>Salary:</strong> Enter numbers only (e.g., 45000), currency symbols will be removed automatically.</p>
                  <p><strong>Column names:</strong> Flexible matching - "First Name", "first_name", "firstName" all work.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Import Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Valid Rows</p>
                      <p className="text-2xl font-bold text-green-600">{preview.validRows}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Error Rows</p>
                      <p className="text-2xl font-bold text-red-600">{preview.errorRows}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Upload className="h-5 w-5 text-gray-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Total Rows</p>
                      <p className="text-2xl font-bold text-gray-600">{preview.totalRows}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Column Mapping</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Map your CSV columns to the required fields. Required fields are marked with an asterisk (*).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(canonicalFields).map(([fieldKey, fieldName]) => {
                    const isRequired = ['firstName', 'lastName'].includes(fieldKey);
                    return (
                      <div key={fieldKey}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {fieldName} {isRequired && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          value={mapping[fieldKey] || ''}
                          onChange={(e) => setMapping(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                          className="input w-full"
                        >
                          <option value="">Select column...</option>
                          {preview.headers.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {preview.preview.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Preview (First 10 rows)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Salary Range</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {preview.preview.map((candidate, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm text-gray-900">{candidate.row}</td>
                            <td className="px-3 py-2 text-sm">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valid
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {candidate.firstName} {candidate.lastName}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">{candidate.email || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {candidate.salaryMin && candidate.salaryMax 
                                ? `£${candidate.salaryMin.toLocaleString()} - £${candidate.salaryMax.toLocaleString()}`
                                : candidate.salaryMin 
                                  ? `£${candidate.salaryMin.toLocaleString()}+`
                                  : candidate.salaryMax
                                    ? `Up to £${candidate.salaryMax.toLocaleString()}`
                                    : '-'
                              }
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(candidate.skills).map(([skill, hasSkill]) => (
                                  <span
                                    key={skill}
                                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                      hasSkill 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {preview.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Invalid Rows</h3>
                    <button
                      onClick={downloadErrorCSV}
                      className="btn btn-sm btn-outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Error CSV
                    </button>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {preview.errors.map((error, index) => (
                      <div key={index} className="mb-4 last:mb-0 p-3 bg-white rounded border border-red-200">
                        <div className="flex items-start">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-900 mb-1">
                              Row {error.row}
                            </p>
                            <div className="text-sm text-red-700">
                              {error.errors.map((err, errIndex) => (
                                <div key={errIndex} className="mb-1 last:mb-0">
                                  • {err}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                              <strong>Data:</strong> {error.data.firstName} {error.data.lastName}
                              {error.data.email && ` (${error.data.email})`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="btn btn-outline"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="btn btn-primary"
                  disabled={importing || preview.validRows === 0}
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    `Import ${preview.validRows} Valid Candidates`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
