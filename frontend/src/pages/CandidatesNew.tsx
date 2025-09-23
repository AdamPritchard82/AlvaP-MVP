import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  MoreVertical,
  DollarSign,
  Tag,
  Upload,
  X
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

export default function CandidatesNew() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    salaryMin: '',
    salaryMax: '',
    skills: [] as string[],
    tags: [] as string[],
    mode: 'OR' as 'AND' | 'OR'
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadCandidates();
  }, [searchTerm, filters, pagination.page]);

  useEffect(() => {
    loadAllTags();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await api.getCandidates({
        q: searchTerm || undefined,
        salaryMin: filters.salaryMin || undefined,
        salaryMax: filters.salaryMax || undefined,
        skills: filters.skills.length > 0 ? filters.skills : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        mode: filters.mode,
        page: pagination.page,
        pageSize: pagination.pageSize
      });
      
      setCandidates(response.candidates || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
        totalPages: response.totalPages || 0
      }));
    } catch (error) {
      toast.error('Failed to load candidates');
      console.error('Error loading candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTags = async () => {
    try {
      const response = await api.getCandidates({ pageSize: 1000 });
      const allCandidates = response.candidates || [];
      const uniqueTags = Array.from(new Set(allCandidates.flatMap(c => c.tags))).sort();
      setAllTags(uniqueTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadCandidates();
  };

  const toggleSkill = (skill: string) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const clearFilters = () => {
    setFilters({
      salaryMin: '',
      salaryMax: '',
      skills: [],
      tags: [],
      mode: 'OR'
    });
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchTerm || 
    filters.salaryMin || filters.salaryMax || 
    filters.skills.length > 0 || filters.tags.length > 0;

  const getSkillCount = (candidate: Candidate) => {
    return Object.values(candidate.skills).filter(Boolean).length;
  };

  const getActiveSkills = (candidate: Candidate) => {
    return Object.entries(candidate.skills)
      .filter(([_, active]) => active)
      .map(([skill, _]) => skill);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Candidates
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your candidate database and track their progress.
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-outline btn-md ${hasActiveFilters ? 'ring-2 ring-primary-500' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-primary-100 text-primary-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {filters.skills.length + filters.tags.length + (searchTerm ? 1 : 0) + (filters.salaryMin ? 1 : 0) + (filters.salaryMax ? 1 : 0)}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-outline btn-md text-gray-600"
            >
              Clear Filters
            </button>
          )}
          <Link
            to="/candidates/new"
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Candidate
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search candidates by name, email, or notes..."
                  className="input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-md"
            >
              Search
            </button>
          </div>

          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Salary Range */}
                <div>
                  <label className="label mb-2 block">Salary Range</label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Min Salary</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">£</span>
                        </div>
                        <input
                          type="number"
                          value={filters.salaryMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, salaryMin: e.target.value }))}
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
                          value={filters.salaryMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, salaryMax: e.target.value }))}
                          className="input pl-8"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="label mb-2 block">Skills</label>
                  <div className="space-y-2">
                    {['communications', 'campaigns', 'policy', 'publicAffairs'].map(skill => (
                      <label key={skill} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.skills.includes(skill)}
                          onChange={() => toggleSkill(skill)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {skill.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label block">Filter by Tags</label>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-500">Mode:</label>
                      <select
                        value={filters.mode}
                        onChange={(e) => setFilters(prev => ({ ...prev, mode: e.target.value as 'AND' | 'OR' }))}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="OR">Any (OR)</option>
                        <option value="AND">All (AND)</option>
                      </select>
                    </div>
                  </div>
                  
                  {filters.tags.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-2">
                        {filters.tags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 hover:bg-primary-200"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                            <X className="h-3 w-3 ml-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          filters.tags.includes(tag)
                            ? 'bg-primary-100 text-primary-800'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Candidates List */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try CSV import or upload a CV to get started.
            </p>
            <div className="mt-6 space-x-3">
              <button className="btn btn-outline btn-md">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </button>
              <Link to="/candidates/new" className="btn btn-primary btn-md">
                <Plus className="h-4 w-4 mr-2" />
                Add Candidate
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skills
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map((candidate) => (
                  <tr 
                    key={candidate.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/candidates/${candidate.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {candidate.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {candidate.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {candidate.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {getActiveSkills(candidate).map(skill => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {skill.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        ))}
                        {getSkillCount(candidate) === 0 && (
                          <span className="text-xs text-gray-400">No skills</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.salary_min && candidate.salary_max ? (
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          {formatCurrency(candidate.salary_min)} - {formatCurrency(candidate.salary_max)}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(candidate.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/candidates/${candidate.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/candidates/${candidate.id}/edit`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button className="text-gray-600 hover:text-gray-900">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



