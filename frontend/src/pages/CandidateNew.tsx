import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import CVUpload from '../components/CVUpload';

export default function CandidateNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentTitle: '',
    currentEmployer: '',
    salaryMin: '',
    salaryMax: '',
    seniority: '',
    tags: [] as string[],
    notes: '',
    emailOk: true,
    skills: {
      communications: 0,
      campaigns: 0,
      policy: 0,
      publicAffairs: 0
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSkillChange = (skill: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [skill]: value
      }
    }));
  };

  const parseCVContent = (text: string) => {
    console.log('Starting to parse CV content...');
    console.log('Raw text received:', text.substring(0, 200) + '...');
    
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log('CV lines:', lines.slice(0, 10));
      
      let firstName = '';
      let lastName = '';
      let email = '';
      let phone = '';
      let currentTitle = '';
      let currentEmployer = '';
      
      // Extract name from first line
      if (lines.length > 0) {
        const firstLine = lines[0];
        // Look for name patterns
        const nameMatch = firstLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (nameMatch) {
          const fullName = nameMatch[1];
          const nameParts = fullName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
          console.log('Extracted name:', firstName, lastName);
        }
      }
      
      // Extract email
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        email = emailMatch[1];
        console.log('Extracted email:', email);
      }
      
      // Extract phone
      const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
      if (phoneMatch) {
        phone = phoneMatch[1];
        console.log('Extracted phone:', phone);
      }
      
      // Look for employment section
      const employmentStart = lines.findIndex(line => {
        const lowerLine = line.toLowerCase();
        return lowerLine.includes('employment') || 
               lowerLine.includes('experience') ||
               lowerLine.includes('work history') ||
               lowerLine.includes('professional experience') ||
               lowerLine.includes('career history') ||
               lowerLine.includes('work experience') ||
               lowerLine.includes('employment history') ||
               lowerLine.includes('current role') ||
               lowerLine.includes('current position');
      });
      
      console.log('Found employment section at line:', employmentStart);
      
      // Extract from employment section or first 20 lines
      const searchStart = employmentStart !== -1 ? employmentStart : 0;
      const searchEnd = Math.min(searchStart + 20, lines.length);
      
      // Look for title and company patterns
      for (let i = searchStart; i < searchEnd; i++) {
        const line = lines[i].trim();
        
        // Skip very short lines, empty lines, and obvious headers
        if (line.length < 3 || 
            line.match(/^(name|email|phone|address|summary|profile|objective|skills|education|experience|employment|work|location|contact|references|achievements|qualifications)/i)) {
          continue;
        }
        
        console.log(`Checking line ${i}: "${line}"`);
        
        // Look for job titles
        if (!currentTitle) {
          const jobKeywords = [
            'manager', 'director', 'officer', 'specialist', 'coordinator', 
            'executive', 'analyst', 'consultant', 'advisor', 'associate', 
            'assistant', 'head', 'chief', 'vice', 'deputy', 'senior', 'junior',
            'lead', 'principal', 'architect', 'engineer', 'developer', 'designer',
            'supervisor', 'superintendent', 'administrator', 'representative',
            'officer', 'agent', 'coordinator', 'facilitator', 'liaison'
          ];
          
          const hasJobKeyword = jobKeywords.some(keyword => 
            line.toLowerCase().includes(keyword)
          );
          
          const looksLikeTitle = /^[A-Z][a-zA-Z\s&,\-\/]+$/.test(line) && 
                                line.length > 4 && line.length < 60 &&
                                !line.includes('@') && !line.includes('http') &&
                                !line.match(/\d{4}/) && // No years
                                !line.toLowerCase().includes('summary') &&
                                !line.toLowerCase().includes('phone') &&
                                !line.toLowerCase().includes('location') &&
                                !line.toLowerCase().includes('address');
          
          if ((hasJobKeyword || looksLikeTitle) && 
              !line.toLowerCase().includes('university') &&
              !line.toLowerCase().includes('college') &&
              !line.toLowerCase().includes('school')) {
            currentTitle = line;
            console.log(`Found job title: "${line}"`);
          }
        }
        
        // Look for companies
        if (!currentEmployer) {
          const companyIndicators = [
            'Corporation', 'Inc', 'Ltd', 'LLC', 'Company', 'Group', 
            'Associates', 'Partners', 'Consulting', 'Services', 'Solutions',
            'Limited', 'International', 'Global', 'Systems', 'Technologies',
            'Enterprises', 'Holdings', 'Industries', 'Organizations', 'Foundation',
            'Institute', 'Society', 'Association', 'Council', 'Board',
            'Ministry', 'Department', 'Agency', 'Authority', 'Commission'
          ];
          
          const hasCompanyIndicator = companyIndicators.some(indicator => 
            line.includes(indicator)
          );
          
          const looksLikeCompany = /^[A-Z][a-zA-Z\s&,\-\/\.]+$/.test(line) && 
                                  line.length > 3 && line.length < 80 &&
                                  !line.includes('@') && !line.includes('http') &&
                                  !line.match(/\d{4}/) && // No years
                                  !line.toLowerCase().includes('summary') &&
                                  !line.toLowerCase().includes('phone') &&
                                  !line.toLowerCase().includes('location') &&
                                  !line.toLowerCase().includes('address') &&
                                  !line.toLowerCase().includes('university') &&
                                  !line.toLowerCase().includes('college') &&
                                  !line.toLowerCase().includes('school');
          
          if ((hasCompanyIndicator || looksLikeCompany) && 
              !line.toLowerCase().includes('university') &&
              !line.toLowerCase().includes('college') &&
              !line.toLowerCase().includes('school')) {
            currentEmployer = line;
            console.log(`Found company: "${line}"`);
          }
        }
      }
      
      console.log('Final extracted title:', currentTitle);
      console.log('Final extracted employer:', currentEmployer);
      
      // Extract skills based on content
      const skills = {
        communications: 0,
        campaigns: 0,
        policy: 0,
        publicAffairs: 0
      };
      
      const textLower = text.toLowerCase();
      if (textLower.includes('communication') || textLower.includes('pr') || textLower.includes('media')) {
        skills.communications = Math.min(5, Math.floor(Math.random() * 3) + 3);
      }
      if (textLower.includes('campaign') || textLower.includes('marketing') || textLower.includes('outreach')) {
        skills.campaigns = Math.min(5, Math.floor(Math.random() * 3) + 3);
      }
      if (textLower.includes('policy') || textLower.includes('government') || textLower.includes('legislative')) {
        skills.policy = Math.min(5, Math.floor(Math.random() * 3) + 3);
      }
      if (textLower.includes('public affairs') || textLower.includes('stakeholder') || textLower.includes('engagement')) {
        skills.publicAffairs = Math.min(5, Math.floor(Math.random() * 3) + 3);
      }
      
      // Generate tags based on skills and title
      const tags = [];
      if (skills.communications > 0) tags.push('communications');
      if (skills.campaigns > 0) tags.push('campaigns');
      if (skills.policy > 0) tags.push('policy');
      if (skills.publicAffairs > 0) tags.push('public-affairs');
      if (currentTitle.toLowerCase().includes('senior')) tags.push('senior');
      if (currentTitle.toLowerCase().includes('manager')) tags.push('management');

      return {
        firstName,
        lastName,
        email,
        phone,
        currentTitle,
        currentEmployer,
        skills,
        tags
      };
    } catch (error) {
      console.error('Error in parseCVContent:', error);
      // Return empty data on error
      return {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        currentTitle: '',
        currentEmployer: '',
        skills: { communications: 0, campaigns: 0, policy: 0, publicAffairs: 0 },
        tags: []
      };
    }
  };

  const handleCVUpload = async (file: File) => {
    setUploadedFile(file);
    setParsing(true);
    
    // Show parsing status
    toast.loading('Parsing CV...', { id: 'cv-parse' });
    
    try {
      // Validate file type - only text files for now
      if (file.type !== 'text/plain') {
        toast.error('Only text files (.txt) are supported for now. Please convert your CV to a .txt file.', { id: 'cv-parse' });
        return;
      }
      
      // Validate file size (20MB limit)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        toast.error('File too large. Please upload files smaller than 20MB.', { id: 'cv-parse' });
        return;
      }
      
      // Call backend API for all file types
      const formData = new FormData();
      formData.append('file', file); // Use 'file' as field name as requested
      
      const response = await fetch('/api/candidates/parse-cv', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - let browser set multipart/form-data
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
        currentTitle: parsedData.currentTitle || '',
        currentEmployer: parsedData.currentEmployer || '',
        skills: {
          communications: parsedData.skills?.communications ? 5 : 0,
          campaigns: parsedData.skills?.campaigns ? 5 : 0,
          policy: parsedData.skills?.policy ? 5 : 0,
          publicAffairs: parsedData.skills?.publicAffairs ? 5 : 0
        },
        tags: Array.isArray(parsedData.tags) ? parsedData.tags.join(', ') : (parsedData.tags || ''),
        notes: parsedData.notes || ''
      }));
      
      toast.success('CV parsed successfully! Fields have been prefilled.', { id: 'cv-parse' });
      
    } catch (error) {
      console.error('Error parsing CV:', error);
      toast.error(`Failed to parse CV: ${error.message}`, { id: 'cv-parse' });
      // Keep manual entry enabled - don't clear the form
    } finally {
      setParsing(false);
    }
  };

  const handleCVRemove = () => {
    setUploadedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = Array.isArray(formData.tags) ? formData.tags : (formData.tags as string).split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
      
      const candidateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        currentTitle: formData.currentTitle || undefined,
        currentEmployer: formData.currentEmployer || undefined,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : undefined,
        seniority: formData.seniority || undefined,
        tags,
        notes: formData.notes || undefined,
        skills: formData.skills
      };

      console.log('Sending candidate data:', candidateData);

      if (uploadedFile) {
        // Create FormData for file upload
        const formDataToSend = new FormData();
        Object.entries(candidateData).forEach(([key, value]) => {
          if (value !== undefined) {
            if (key === 'skills' || key === 'tags') {
              formDataToSend.append(key, JSON.stringify(value));
            } else {
              formDataToSend.append(key, String(value));
            }
          }
        });
        formDataToSend.append('cv', uploadedFile);

        // Upload with file
        const response = await fetch('/api/candidates', {
          method: 'POST',
          body: formDataToSend,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to create candidate');
        }

        const result = await response.json();
        toast.success('Candidate created successfully');
        navigate(`/candidates/${result.id}`);
      } else {
        // Create without file
        const result = await api.createCandidate(candidateData);
        toast.success('Candidate created successfully');
        navigate(`/candidates/${result.id}`);
      }
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CV Upload */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CV Upload (Optional)
            </label>
            <CVUpload
              onUpload={handleCVUpload}
              onRemove={handleCVRemove}
              disabled={loading}
              parsing={parsing}
            />
            <p className="mt-2 text-xs text-gray-500">
              Upload a CV to automatically extract candidate information
            </p>
          </div>

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
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="emailOk"
                  checked={formData.emailOk}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailOk: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send welcome email and future updates
                </span>
              </label>
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Title
              </label>
              <input
                type="text"
                name="currentTitle"
                value={formData.currentTitle}
                onChange={handleInputChange}
                className="input"
                placeholder="Enter current job title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Employer
              </label>
              <input
                type="text"
                name="currentEmployer"
                value={formData.currentEmployer}
                onChange={handleInputChange}
                className="input"
                placeholder="Enter current employer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seniority Level
              </label>
              <select
                name="seniority"
                value={formData.seniority}
                onChange={handleInputChange}
                className="input"
              >
                <option value="">Select seniority level</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid-level</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="director">Director</option>
                <option value="executive">Executive</option>
              </select>
            </div>
          </div>

          {/* Salary Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Salary Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Salary
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">£</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Salary
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">£</span>
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
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Skills Assessment</h3>
            
            {Object.entries(formData.skills).map(([skill, value]) => (
              <div key={skill}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {skill.charAt(0).toUpperCase() + skill.slice(1).replace(/([A-Z])/g, ' $1')}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={value}
                    onChange={(e) => handleSkillChange(skill, parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 w-8">{value}/5</span>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Information */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
            
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
          </div>
        </div>

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



