import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  MoreVertical,
  MapPin,
  Briefcase,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle,
  Upload
} from 'lucide-react';
import { api, Candidate } from '../lib/api';
import { LibrarySkills } from './Library';
import { formatDate, formatCurrency } from '../lib/utils';
import { useUsage } from '../hooks/useUsage';
import UpgradePrompt, { UsageLimitPrompt } from '../components/UpgradePrompt';
import CSVImport from '../components/CSVImport';
import toast from 'react-hot-toast';

export default function Candidates() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState<number | ''>('');
  const [salaryMax, setSalaryMax] = useState<number | ''>('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'AND' | 'OR'>('OR');
  const [showCSVImport, setShowCSVImport] = useState(false);
  const { usage, isLimitReached, getUsagePercentage } = useUsage();

  useEffect(() => {
    loadCandidates();
  }, [searchTerm, selectedTags, salaryMin, salaryMax, selectedSkills, tagMode]);

  useEffect(() => {
    loadAllTags();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await api.getCandidates({
        search: searchTerm || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        salaryMin: salaryMin || undefined,
        salaryMax: salaryMax || undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        mode: tagMode,
        limit: 50
      });
      setCandidates(Array.isArray(response.candidates) ? response.candidates : []);
    } catch (error) {
      toast.error('Failed to load candidates');
      console.error('Error loading candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTags = async () => {
    try {
      // Load all candidates to get all available tags
      const response = await api.getCandidates({ limit: 1000 });
      const allCandidates = Array.isArray(response.candidates) ? response.candidates : [];
      const uniqueTags = Array.from(new Set(allCandidates.flatMap(c => Array.isArray(c.tags) ? c.tags : []))).sort();
      setAllTags(uniqueTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCandidates();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setSalaryMin('');
    setSalaryMax('');
    setSelectedSkills([]);
    setTagMode('OR');
  };

  const hasActiveFilters = searchTerm || selectedTags.length > 0 || salaryMin || salaryMax || selectedSkills.length > 0;

  const getStatusIcon = (candidate: Candidate) => {
    if (candidate.parse_status === 'error') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (candidate.parse_status === 'parsed') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <div className="h-4 w-4 rounded-full bg-yellow-400" />;
  };

  const getStatusText = (candidate: Candidate) => {
    if (candidate.parse_status === 'error') return 'Parse Error';
    if (candidate.parse_status === 'parsed') return 'Ready';
    if (candidate.parse_status === 'parsing') return 'Parsing...';
    return 'Unparsed';
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
                {selectedTags.length + selectedSkills.length + (searchTerm ? 1 : 0) + (salaryMin ? 1 : 0) + (salaryMax ? 1 : 0)}
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
          <button
            onClick={() => setShowCSVImport(true)}
            className="btn btn-outline btn-md"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </button>
          <Link
            to="/candidates/new"
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Candidate
          </Link>
        </div>
      </div>

      {/* Usage Limits */}
      {usage && (
        <>
          {isLimitReached('candidates') && (
            <UsageLimitPrompt
              resource="candidates"
              current={usage.current.candidates}
              limit={usage.limits.candidates}
              className="mb-6"
            />
          )}
          
          {getUsagePercentage('candidates') >= 75 && !isLimitReached('candidates') && (
            <UsageLimitPrompt
              resource="candidates"
              current={usage.current.candidates}
              limit={usage.limits.candidates}
              className="mb-6"
            />
          )}
        </>
      )}

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
                  placeholder="Search candidates by name, title, or company..."
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
                          value={salaryMin}
                          onChange={(e) => setSalaryMin(e.target.value ? Number(e.target.value) : '')}
                          min="10000"
                          max="200000"
                          step="10000"
                          className="input pl-8"
                          placeholder="10000"
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
                          value={salaryMax}
                          onChange={(e) => setSalaryMax(e.target.value ? Number(e.target.value) : '')}
                          min="10000"
                          max="200000"
                          step="10000"
                          className="input pl-8"
                          placeholder="200000"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="label mb-2 block">Skills (3+ rating)</label>
                  <div className="space-y-2">
                    {['communications', 'campaigns', 'policy', 'publicAffairs'].map(skill => (
                      <label key={skill} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes(skill)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSkills(prev => [...prev, skill]);
                            } else {
                              setSelectedSkills(prev => prev.filter(s => s !== skill));
                            }
                          }}
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
                    <label className="label block">
                      Filter by Tags
                      {allTags.length === 0 && (
                        <span className="text-gray-400 text-sm font-normal ml-2">(No tags available)</span>
                      )}
                    </label>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-500">Mode:</label>
                      <select
                        value={tagMode}
                        onChange={(e) => setTagMode(e.target.value as 'AND' | 'OR')}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="OR">Any (OR)</option>
                        <option value="AND">All (AND)</option>
                      </select>
                    </div>
                  </div>
                  
                  {selectedTags.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 hover:bg-primary-200"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                            <span className="ml-1 text-primary-600">×</span>
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
                          selectedTags.includes(tag)
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

      {/* Library Skills Grid (below search bar and buttons) */}
      <div className="card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Library</h3>
          <p className="text-sm text-gray-500">Browse by skill and salary band.</p>
        </div>
        <LibrarySkills />
      </div>

      {/* Candidates List */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try CSV import or upload a CV to get started.
            </p>
            <div className="mt-6 space-x-3">
              <button
                onClick={() => setShowCSVImport(true)}
                className="btn btn-outline btn-md"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </button>
              <Link
                to="/candidates/new"
                className="btn btn-primary btn-md"
              >
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
                    Current Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                      <div className="text-sm text-gray-900">
                        {candidate.current_title || 'No title'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {candidate.current_employer || 'No employer'}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(candidate)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getStatusText(candidate)}
                        </span>
                      </div>
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

      {/* CSV Import Modal */}
      {showCSVImport && (
        <CSVImport
          onImportComplete={() => {
            loadCandidates();
            setShowCSVImport(false);
          }}
          onClose={() => setShowCSVImport(false)}
        />
      )}
    </div>
  );
}




