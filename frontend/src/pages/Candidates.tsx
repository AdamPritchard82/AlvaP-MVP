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
  Upload,
  Trash2,
  Undo2
} from 'lucide-react';
import { api, Candidate } from '../lib/api';
import { LibrarySkills } from './Library';
import { formatDate, formatCurrency } from '../lib/utils';
import { useUsage } from '../hooks/useUsage';
import UpgradePrompt, { UsageLimitPrompt } from '../components/UpgradePrompt';
import CSVImport from '../components/CSVImport';
import ResponsiveCandidateList from '../components/ResponsiveCandidateList';
import StickyActionBar from '../components/StickyActionBar';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import MobileCVUpload from '../components/MobileCVUpload';
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
  const [deletingCandidate, setDeletingCandidate] = useState<string | null>(null);
  const [deletedCandidates, setDeletedCandidates] = useState<Set<string>>(new Set());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileCVUpload, setShowMobileCVUpload] = useState(false);
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

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to delete ${candidateName}? This action can be undone.`)) {
      return;
    }

    try {
      setDeletingCandidate(candidateId);
      await api.deleteCandidate(candidateId);
      
      // Add to deleted set for undo functionality
      setDeletedCandidates(prev => new Set([...prev, candidateId]));
      
      // Remove from candidates list
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
      
      toast.success('Candidate deleted successfully', {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => handleRestoreCandidate(candidateId, candidateName)
        }
      });
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast.error('Failed to delete candidate');
    } finally {
      setDeletingCandidate(null);
    }
  };

  const handleRestoreCandidate = async (candidateId: string, candidateName: string) => {
    try {
      await api.restoreCandidate(candidateId);
      
      // Remove from deleted set
      setDeletedCandidates(prev => {
        const newSet = new Set(prev);
        newSet.delete(candidateId);
        return newSet;
      });
      
      // Reload candidates to show restored candidate
      await loadCandidates();
      
      toast.success(`${candidateName} restored successfully`);
    } catch (error) {
      console.error('Error restoring candidate:', error);
      toast.error('Failed to restore candidate');
    }
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
          {/* Mobile: Prominent search bar with filter button */}
          <div className="block md:hidden">
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search candidates..."
                  className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowMobileFilters(true)}
                className="px-4 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
              >
                <Filter className="h-6 w-6 mr-2" />
                {hasActiveFilters && (
                  <span className="bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ml-1">
                    {selectedTags.length + selectedSkills.length + (searchTerm ? 1 : 0) + (salaryMin ? 1 : 0) + (salaryMax ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop: Original search layout */}
          <div className="hidden md:flex space-x-4">
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

      {/* Add Candidate Card - moved above Library tiles */}
      <div className="card p-6 order-1">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Plus className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Add New Candidate</h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload a CV or manually enter candidate details
          </p>
          <div className="space-x-3">
            <Link
              to="/candidates/new"
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Candidate
            </Link>
            <button
              onClick={() => setShowCSVImport(true)}
              className="btn btn-outline btn-md"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Library Skills Grid */}
      <div className="card p-6 order-2">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Library</h3>
          <p className="text-sm text-gray-500">Browse by skill and salary band.</p>
        </div>
        <LibrarySkills />
      </div>

      {/* Candidates List */}
      <div className="card order-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Start with keyword search</h3>
            <p className="mt-1 text-sm text-gray-500">
              Use the search bar above to find candidates by skills, experience, or keywords.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  // Focus the search input
                  const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                  if (searchInput) {
                    searchInput.focus();
                    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="btn btn-primary btn-md"
              >
                <Search className="h-4 w-4 mr-2" />
                Start Searching
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Or <button 
                onClick={() => setShowCSVImport(true)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                import CSV
              </button> to add candidates
            </div>
          </div>
        ) : (
          <ResponsiveCandidateList
            candidates={candidates}
            loading={loading}
            onDelete={(id) => {
              const candidate = candidates.find(c => c.id === id);
              if (candidate) {
                handleDeleteCandidate(id, candidate.full_name);
              }
            }}
            onRestore={handleRestoreCandidate}
            deletingCandidate={deletingCandidate}
            deletedCandidates={deletedCandidates}
          />
        )}
      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        onApplyFilters={() => {
          // Filters are already applied via useEffect
        }}
        onClearFilters={clearFilters}
        activeFilterCount={selectedTags.length + selectedSkills.length + (searchTerm ? 1 : 0) + (salaryMin ? 1 : 0) + (salaryMax ? 1 : 0)}
      >
        {/* Mobile Filter Content */}
        <div className="space-y-6">
          {/* Salary Range */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Salary Range
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Min Salary</label>
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
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="10000"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Salary</label>
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
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="200000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Skills</h4>
            <div className="grid grid-cols-2 gap-2">
              {['communications', 'campaigns', 'policy', 'publicAffairs'].map(skill => (
                <button
                  key={skill}
                  onClick={() => {
                    if (selectedSkills.includes(skill)) {
                      setSelectedSkills(selectedSkills.filter(s => s !== skill));
                    } else {
                      setSelectedSkills([...selectedSkills, skill]);
                    }
                  }}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    selectedSkills.includes(skill)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{skill}</span>
                    {selectedSkills.includes(skill) && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Tag className="h-4 w-4 mr-2" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`px-3 py-2 text-sm border rounded-full transition-colors ${
                      selectedTags.includes(tag)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </MobileFilterDrawer>

      {/* Mobile CV Upload */}
      <MobileCVUpload
        isOpen={showMobileCVUpload}
        onClose={() => setShowMobileCVUpload(false)}
        onUploadSuccess={(candidate) => {
          loadCandidates();
          toast.success('CV uploaded and candidate added successfully!');
        }}
      />

      {/* Sticky Action Bar for Mobile */}
      <StickyActionBar
        onSearchClick={() => {
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
        onImportClick={() => setShowCSVImport(true)}
        onCVUploadClick={() => setShowMobileCVUpload(true)}
      />

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




