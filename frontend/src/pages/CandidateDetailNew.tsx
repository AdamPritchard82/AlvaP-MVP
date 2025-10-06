import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Mail, 
  Phone, 
  DollarSign,
  Tag,
  FileText,
  Calendar
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  salary_min: number | null;
  salary_max: number | null;
  skills: {
    communications: boolean;
    campaigns: boolean;
    policy: boolean;
    publicAffairs: boolean;
  };
  tags: string[];
  notes: string;
  email_ok: boolean;
  created_at: string;
  updated_at: string;
}

export default function CandidateDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (id) {
      loadCandidate();
    }
  }, [id]);

  const loadCandidate = async () => {
    try {
      setLoading(true);
      const response = await api.getCandidate(id!);
      const candidateData = response.candidate;
      
      setCandidate(candidateData);
      
      // Parse full name into first/last
      const nameParts = candidateData.full_name.split(' ');
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: candidateData.email || '',
        phone: candidateData.phone || '',
        salaryMin: candidateData.salary_min?.toString() || '',
        salaryMax: candidateData.salary_max?.toString() || '',
        skills: candidateData.skills || {
          communications: false,
          campaigns: false,
          policy: false,
          publicAffairs: false
        },
        tags: candidateData.tags?.join(', ') || '',
        notes: candidateData.notes || '',
        emailOk: candidateData.email_ok
      });
    } catch (error) {
      console.error('Error loading candidate:', error);
      toast.error('Failed to load candidate');
      navigate('/candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if ((name === 'salaryMin' || name === 'salaryMax') && value) {
      const num = Math.max(10000, Math.min(200000, Math.round(Number(value) / 10000) * 10000));
      setFormData(prev => ({ ...prev, [name]: String(num) }));
      return;
    }
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

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
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

      await api.updateCandidate(id!, updateData);
      
      // Reload candidate data
      await loadCandidate();
      setEditing(false);
      toast.success('Candidate updated successfully');
    } catch (error) {
      console.error('Error updating candidate:', error);
      toast.error('Failed to update candidate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      return;
    }

    try {
      await api.deleteCandidate(id!);
      toast.success('Candidate deleted successfully');
      navigate('/candidates');
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast.error('Failed to delete candidate');
    }
  };

  const getActiveSkills = (skills: Candidate['skills']) => {
    return Object.entries(skills)
      .filter(([_, active]) => active)
      .map(([skill, _]) => skill);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Candidate not found</h3>
        <p className="mt-1 text-sm text-gray-500">The candidate you're looking for doesn't exist.</p>
        <Link to="/candidates" className="btn btn-primary btn-md mt-4">
          Back to Candidates
        </Link>
      </div>
    );
  }

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
                {candidate.full_name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Added {formatDate(candidate.created_at)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="btn btn-outline btn-md"
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn btn-primary btn-md"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                className="btn btn-outline btn-md text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
              <button
                onClick={() => setEditing(true)}
                className="btn btn-primary btn-md"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="input"
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
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-sm text-gray-900">
                    {candidate.email || 'No email provided'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-sm text-gray-900">
                    {candidate.phone || 'No phone provided'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Salary Expectations */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Salary Expectations</h3>
            
            {editing ? (
              <div className="space-y-4">
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
                          min="10000"
                          max="200000"
                          step="10000"
                          className="input pl-8"
                          placeholder="e.g. 40000"
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
                          min="10000"
                          max="200000"
                          step="10000"
                          className="input pl-8"
                          placeholder="e.g. 60000"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter tags separated by commas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={4}
                    className="input"
                    placeholder="Enter any additional notes"
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
            ) : (
              <div className="space-y-4">
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                  <span className="text-sm text-gray-900">
                    {candidate.salary_min && candidate.salary_max ? (
                      `${formatCurrency(candidate.salary_min)} - ${formatCurrency(candidate.salary_max)}`
                    ) : (
                      'No salary range specified'
                    )}
                  </span>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <Tag className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-700">Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getActiveSkills(candidate.skills).map(skill => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {skill.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    ))}
                    {getActiveSkills(candidate.skills).length === 0 && (
                      <span className="text-sm text-gray-400">No skills specified</span>
                    )}
                  </div>
                </div>

                {candidate.tags && candidate.tags.length > 0 && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Tag className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {candidate.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {candidate.notes && (
                  <div>
                    <div className="flex items-center mb-2">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Notes</span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{candidate.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email Updates</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  candidate.email_ok 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {candidate.email_ok ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm text-gray-900">{formatDate(candidate.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Updated</span>
                <span className="text-sm text-gray-900">{formatDate(candidate.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="w-full btn btn-outline btn-sm justify-start"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </a>
              )}
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="w-full btn btn-outline btn-sm justify-start"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



