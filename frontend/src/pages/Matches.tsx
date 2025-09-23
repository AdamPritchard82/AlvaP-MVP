import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  MoreVertical,
  Target,
  User,
  Briefcase,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { api, Match } from '../lib/api';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [searchTerm, stageFilter]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await api.getMatches({
        stage: stageFilter || undefined,
        limit: 50
      });
      setMatches(response.matches || []);
    } catch (error) {
      toast.error('Failed to load matches');
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMatches();
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'new':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'reviewed':
        return <Eye className="h-4 w-4 text-yellow-500" />;
      case 'contacted':
        return <Target className="h-4 w-4 text-purple-500" />;
      case 'interviewed':
        return <User className="h-4 w-4 text-indigo-500" />;
      case 'offered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'placed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'reviewed':
        return 'bg-yellow-100 text-yellow-800';
      case 'contacted':
        return 'bg-purple-100 text-purple-800';
      case 'interviewed':
        return 'bg-indigo-100 text-indigo-800';
      case 'offered':
        return 'bg-green-100 text-green-800';
      case 'placed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const stageOptions = [
    { value: '', label: 'All Stages' },
    { value: 'new', label: 'New' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'offered', label: 'Offered' },
    { value: 'placed', label: 'Placed' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Matches & Pipeline
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Review and manage candidate-job matches through your recruitment pipeline.
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-outline btn-md"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
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
                  placeholder="Search matches by candidate name, job title, or client..."
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label mb-2 block">Stage</label>
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="input"
                  >
                    {stageOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stageOptions.slice(1).map((stage) => {
          const count = matches.filter(m => m.stage === stage.value).length;
          return (
            <div key={stage.value} className="card p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {getStageIcon(stage.value)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{stage.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matches List */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No matches</h3>
            <p className="mt-1 text-sm text-gray-500">
              Matches will appear here when candidates are matched with jobs.
            </p>
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
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Match Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {matches.map((match) => (
                  <tr key={match.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {match.candidate?.full_name.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {match.candidate?.full_name || 'Unknown Candidate'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {match.candidate?.current_title || 'No title'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {match.job?.title || 'Unknown Job'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {match.job?.client?.name || 'Unknown Client'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 mr-1" />
                        <span className={`text-sm font-medium ${getScoreColor(match.score)}`}>
                          {Math.round(match.score)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStageIcon(match.stage)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(match.stage)}`}>
                          {match.stage}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(match.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/matches/${match.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/matches/${match.id}/edit`}
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
    </div>
  );
}







