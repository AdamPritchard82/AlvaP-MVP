import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentEmployer: string;
  salaryMin: string;
  salaryMax: string;
  skills: {
    communications: number;
    campaigns: number;
    policy: number;
    publicAffairs: number;
  };
  tags: string[];
  notes: string;
  emailOk: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

const CandidateNew: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [editMode, setEditMode] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<FormData> | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentTitle: '',
    currentEmployer: '',
    salaryMin: '',
    salaryMax: '',
    skills: {
      communications: 0,
      campaigns: 0,
      policy: 0,
      publicAffairs: 0
    },
    tags: [],
    notes: '',
    emailOk: true
  });

  // Validation function
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    
    // Required fields
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.phone.trim()) errors.phone = 'Phone is required';
    if (!formData.currentTitle.trim()) errors.currentTitle = 'Job title is required';
    if (!formData.currentEmployer.trim()) errors.currentEmployer = 'Employer is required';
    
    // Email format validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Skills validation - at least one skill must be rated
    const hasSkills = Object.values(formData.skills).some(value => value > 0);
    if (!hasSkills) errors.skills = 'Please rate at least one skill';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if form is valid (for UI feedback) - Allow CV upload first
  const isFormValid = (): boolean => {
    // Very basic validation - just check if we have any data at all
    return formData.firstName.trim() !== '' || 
           formData.lastName.trim() !== '' || 
           formData.email.trim() !== '';
  };

  // Check if form is complete (for final submission)
  const isFormComplete = (): boolean => {
    return formData.firstName.trim() !== '' &&
           formData.lastName.trim() !== '' &&
           formData.email.trim() !== '' &&
           formData.phone.trim() !== '' &&
           formData.currentTitle.trim() !== '' &&
           formData.currentEmployer.trim() !== '' &&
           Object.values(formData.skills).some(value => value > 0) &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  };

  // Helper function to check if a field was parsed from CV
  const isFieldParsed = (fieldName: keyof FormData): boolean => {
    return editMode && parsedData && parsedData[fieldName] !== undefined && parsedData[fieldName] !== '';
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    // Clamp salary fields to whole increments of 10000
    if ((name === 'salaryMin' || name === 'salaryMax') && value) {
      const num = Math.max(10000, Math.min(200000, Math.round(Number(value) / 10000) * 10000));
      setFormData(prev => ({ ...prev, [name]: String(num) }));
      if (validationErrors[name]) {
        setValidationErrors(prev => ({ ...prev, [name]: '' }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle skill rating changes
  const handleSkillChange = (skill: keyof FormData['skills'], value: number) => {
    setFormData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [skill]: value
      }
    }));
    
    // Clear skills validation error
    if (validationErrors.skills) {
      setValidationErrors(prev => ({
        ...prev,
        skills: ''
      }));
    }
  };

  // Handle CV file upload and parsing
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.txt', '.pdf', '.docx', '.doc'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error('Please upload a .txt, .pdf, .docx, or .doc file');
      return;
    }

    setLoading(true);
    
    try {
      const result = await api.parseCV(file);
      
      if (result.success && result.data) {
        const parsedData = result.data;
        
        // Auto-fill form with parsed data
        const title = (parsedData.currentTitle || '').toLowerCase();
        const employer = (parsedData.currentEmployer || '').toLowerCase();
        
        // Set default skills based on job title and employer
        const defaultSkills = {
          communications: 0,
          campaigns: 0,
          policy: 0,
          publicAffairs: 0
        };
        
        // If it's a director-level role, give them some default skills
        if (title.includes('director') || title.includes('head') || title.includes('manager')) {
          defaultSkills.communications = 4;
          defaultSkills.publicAffairs = 4;
        }
        
        // If it's Door 10, they likely have public affairs skills
        if (employer.includes('door') || employer.includes('10')) {
          defaultSkills.publicAffairs = 4;
          defaultSkills.communications = 4;
        }
        
        // If title mentions specific areas, set those skills
        if (title.includes('policy') || title.includes('government')) {
          defaultSkills.policy = 4;
        }
        if (title.includes('campaign') || title.includes('marketing')) {
          defaultSkills.campaigns = 4;
        }
        if (title.includes('communication') || title.includes('media')) {
          defaultSkills.communications = 4;
        }
        
        setFormData(prev => ({
          ...prev,
          firstName: parsedData.firstName || prev.firstName,
          lastName: parsedData.lastName || prev.lastName,
          email: parsedData.email || prev.email,
          phone: parsedData.phone || prev.phone,
          currentTitle: parsedData.currentTitle || prev.currentTitle,
          currentEmployer: parsedData.currentEmployer || prev.currentEmployer,
          skills: defaultSkills
        }));
        
        // Store parsed data and enable edit mode
        setParsedData(parsedData);
        setEditMode(true);
        
        toast.success(`CV parsed successfully! Please review and edit the information below.`);
      } else {
        toast.error('Failed to parse CV');
      }
    } catch (error) {
      console.error('CV parsing error:', error);
      toast.error('Failed to parse CV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormComplete()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await api.createCandidate(formData);
      
      if (result.success) {
        toast.success('Candidate created successfully!');
        navigate('/candidates');
      } else {
        throw new Error(result.message || 'Failed to create candidate');
      }
    } catch (error) {
      console.error('Error creating candidate:', error);
      toast.error('Failed to create candidate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Candidate</h1>
              <p className="mt-2 text-gray-600">
                Upload a CV to auto-fill information, or enter details manually.
              </p>
            </div>
            {editMode && (
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Exit Edit Mode
              </button>
            )}
          </div>
          {editMode && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Edit Mode:</strong> Review and correct the information parsed from the CV. 
                    Fields with green indicators were automatically filled from the CV.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Status Indicator */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {isFormComplete() ? (
                <span className="text-green-600 font-medium">✓ Ready to save candidate</span>
              ) : isFormValid() ? (
                <span className="text-blue-600">📄 Upload CV or fill remaining fields</span>
              ) : (
                <span className="text-gray-600">📝 Upload a CV to get started, or enter details manually</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Required: Name, Email, Phone, Job Title, Employer, Skills
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* CV Upload Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">CV Upload</h2>
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200"
              >
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Drop your CV here, or{' '}
                      <label className="text-blue-600 hover:text-blue-500 cursor-pointer">
                        browse files
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          onChange={handleFileInputChange}
                          disabled={loading}
                          className="hidden"
                        />
                      </label>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports PDF, DOCX, DOC, and TXT files
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Alternative Upload Method */}
              <div className="text-center">
                <span className="text-sm text-gray-500">or</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose File
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleFileInputChange}
                  disabled={loading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Upload a CV to automatically fill in candidate information
                </p>
              </div>
            </div>
          </div>

          {/* Personal/Professional Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Personal/Professional Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                  {isFieldParsed('firstName') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.firstName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('firstName') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter first name"
                />
                {validationErrors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                  {isFieldParsed('lastName') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.lastName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('lastName') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter last name"
                />
                {validationErrors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                  {isFieldParsed('email') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('email') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter email address"
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                  {isFieldParsed('phone') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('phone') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                />
                {validationErrors.phone && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.phone}</p>
                )}
              </div>

              {/* Moved from Professional Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Job Title *
                  {isFieldParsed('currentTitle') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="currentTitle"
                  value={formData.currentTitle}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.currentTitle ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('currentTitle') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter current job title"
                />
                {validationErrors.currentTitle && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.currentTitle}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Employer *
                  {isFieldParsed('currentEmployer') && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Parsed from CV
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="currentEmployer"
                  value={formData.currentEmployer}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.currentEmployer ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 
                    isFieldParsed('currentEmployer') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter current employer"
                />
                {validationErrors.currentEmployer && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.currentEmployer}</p>
                )}
              </div>
            </div>
          </div>

          {/* Salary Expectations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Salary Expectations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Salary inputs remain here */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salary Range (Min)
                </label>
                <input
                  type="number"
                  name="salaryMin"
                  value={formData.salaryMin}
                  onChange={handleInputChange}
                  min="10000"
                  max="200000"
                  step="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 40000"
                />
                <p className="mt-1 text-xs text-gray-500">Increments of £10,000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salary Range (Max)
                </label>
                <input
                  type="number"
                  name="salaryMax"
                  value={formData.salaryMax}
                  onChange={handleInputChange}
                  min="10000"
                  max="200000"
                  step="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 60000"
                />
                <p className="mt-1 text-xs text-gray-500">Increments of £10,000</p>
              </div>
            </div>
          </div>

          {/* Skills Assessment */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Skills Assessment *</h2>
            <p className="text-sm text-gray-600 mb-6">
              Rate the candidate's skills from 1 (beginner) to 5 (expert)
            </p>
            
            <div className="space-y-4">
              {Object.entries(formData.skills).map(([skill, value]) => (
                <div key={skill} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 capitalize">
                    {skill.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleSkillChange(skill as keyof FormData['skills'], rating)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                          value >= rating
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-white border-gray-300 text-gray-500 hover:border-blue-300'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {validationErrors.skills && (
              <p className="mt-2 text-sm text-red-600">{validationErrors.skills}</p>
            )}
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any additional notes about the candidate"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="emailOk"
                  checked={formData.emailOk}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Candidate has consented to receive emails
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/candidates')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormComplete()}
              className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateNew;
