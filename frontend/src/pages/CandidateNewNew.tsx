import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, FileText, X } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function CandidateNewNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    salaryMin: '',
    salaryMax: '',
    skills: {
      communications: false,
      campaigns: false,
      policy: false,
      publicAffairs: false
    },
    tags: '',
    notes: '',
    emailOk: true
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSkillChange = (skill: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [skill]: checked
      }
    }));
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setParsing(true);
    
    toast.loading('Parsing CV...', { id: 'cv-parse' });
    
    try {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Unsupported file type. Please upload PDF, DOCX, or TXT files.', { id: 'cv-parse' });
        return;
      }
      
      // Validate file size (20MB limit)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        toast.error('File too large. Please upload files smaller than 20MB.', { id: 'cv-parse' });
        return;
      }
      
      // Call backend API
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/candidates/parse-cv`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to parse CV');
      }
      
      const parsedData = result.data;
      
      // Prefill form with parsed data
      setFormData(prev => ({
        ...prev,
        firstName: parsedData.firstName || '',
        lastName: parsedData.lastName || '',
        email: parsedData.email || '',
        phone: parsedData.phone || '',
        skills: {
          communications: parsedData.skills?.communications || false,
          campaigns: parsedData.skills?.campaigns || false,
          policy: parsedData.skills?.policy || false,
          publicAffairs: parsedData.skills?.publicAffairs || false
        },
        tags: Array.isArray(parsedData.tags) ? parsedData.tags.join(', ') : (parsedData.tags || ''),
        notes: parsedData.notes || ''
      }));
      
      // Switch to manual tab to show prefilled data
      setActiveTab('manual');
      
      const confidencePercent = Math.round((parsedData.confidence || 0) * 100);
      toast.success(`CV parsed successfully! Parsed from ${parsedData.source} (confidence ${confidencePercent}%)`, { id: 'cv-parse' });
      
    } catch (error) {
      console.error('Error parsing CV:', error);
      toast.error(`Failed to parse CV: ${error.message}`, { id: 'cv-parse' });
    } finally {
      setParsing(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const candidateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : undefined,
        skills: formData.skills,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
        notes: formData.notes || undefined,
        emailOk: formData.emailOk
      };

      const result = await api.createCandidate(candidateData);
      toast.success('Candidate created successfully');
      navigate(`/candidates/${result.id}`);
    } catch (error) {
      console.error('Error creating candidate:', error);
      toast.error('Failed to create candidate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/candidates')}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Add New Candidate
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Create a new candidate profile with CV upload or manual entry.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upload'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload CV
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Manual Entry
          </button>
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'upload' && (
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload CV</h3>
            
            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                uploadedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              } ${parsing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => {
                if (!parsing) {
                  document.getElementById('file-input')?.click();
                }
              }}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                disabled={parsing}
              />
              
              {uploadedFile ? (
                <div>
                  <div className="flex items-center justify-center mb-2">
                    {parsing ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    ) : (
                      <FileText className="h-8 w-8 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-green-800 mb-1">
                    {parsing ? 'Parsing CV...' : 'CV Uploaded'}
                  </p>
                  <p className="text-xs text-green-600 mb-3">{uploadedFile.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileRemove();
                    }}
                    disabled={parsing}
                    className="inline-flex items-center px-3 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-white hover:bg-green-50 disabled:opacity-50"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Drop your CV here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports PDF, DOCX, TXT up to 20MB
                  </p>
                </div>
              )}
            </div>
            
            <p className="mt-4 text-sm text-gray-500">
              Upload a CV to automatically extract candidate information. The form will be prefilled with the parsed data.
            </p>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="input"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="input"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Professional Information</h3>
              
              {/* Salary Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Salary Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Min Salary</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-sm">£</span>
                      </div>
                      <input
                        type="number"
                        name="salaryMin"
                        value={formData.salaryMin}
                        onChange={handleInputChange}
                        className="input pl-8"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Max Salary</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-sm">£</span>
                      </div>
                      <input
                        type="number"
                        name="salaryMax"
                        value={formData.salaryMax}
                        onChange={handleInputChange}
                        className="input pl-8"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills Assessment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                <div className="space-y-2">
                  {Object.entries(formData.skills).map(([skill, value]) => (
                    <label key={skill} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => handleSkillChange(skill, e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">
                        {skill.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Enter tags separated by commas (e.g., marketing, digital, campaigns)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="input"
                  placeholder="Enter any additional notes about this candidate"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="emailOk"
                    checked={formData.emailOk}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Send welcome email and future updates
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/candidates')}
            className="btn btn-outline btn-md"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-md"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Candidate
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

