import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface SuggestedCandidate {
  candidate_id: string;
  full_name: string;
  current_title: string;
  current_employer: string;
  salary_min: number;
  salary_max: number;
  band_label: string;
  skills: Record<string, boolean>;
  score: number;
  why: string[];
}

interface SuggestedCandidatesProps {
  jobId: string;
  jobTitle: string;
}

export function SuggestedCandidates({ jobId, jobTitle }: SuggestedCandidatesProps) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<SuggestedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score');
  const pageSize = 5;

  useEffect(() => {
    loadMatches();
  }, [jobId, currentPage, sortBy]);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getJobMatches(jobId, pageSize, currentPage * pageSize);
      setMatches(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to load matches:', err);
      setError('Failed to load suggested candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCandidate = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`);
  };

  const handleAddToPipeline = (candidateId: string) => {
    // TODO: Implement add to pipeline functionality
    console.log('Add to pipeline:', candidateId);
  };

  const formatSalary = (min: number, max: number) => {
    return `£${Math.round(min/1000)}k–£${Math.round(max/1000)}k`;
  };

  const formatScore = (score: number) => {
    return `${Math.round(score)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Suggested Candidates</h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Suggested Candidates</h3>
        <div className="text-red-600 mb-4">{error}</div>
        <button 
          onClick={loadMatches}
          className="btn btn-sm btn-outline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Suggested Candidates</h3>
        <div className="text-gray-500 text-center py-8">
          <div className="text-4xl mb-2">🔍</div>
          <p>No matches yet.</p>
          <p className="text-sm">Try adding skills or widening salary range.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Suggested Candidates</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'recent')}
            className="select select-sm select-bordered"
          >
            <option value="score">Score</option>
            <option value="recent">Recently Updated</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <div key={match.candidate_id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-lg">{match.full_name}</h4>
                <p className="text-gray-600">{match.current_title}</p>
                <p className="text-sm text-gray-500">{match.current_employer}</p>
              </div>
              <div className="text-right">
                <div className={`font-bold text-lg ${getScoreColor(match.score)}`}>
                  {formatScore(match.score)}
                </div>
                <div className="text-sm text-gray-500">
                  {formatSalary(match.salary_min, match.salary_max)}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-600">
                <strong>Why this match:</strong>
              </div>
              <ul className="text-sm text-gray-600 ml-4">
                {match.why.map((reason, index) => (
                  <li key={index} className="list-disc">{reason}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewCandidate(match.candidate_id)}
                className="btn btn-sm btn-primary"
              >
                View Candidate
              </button>
              <button
                onClick={() => handleAddToPipeline(match.candidate_id)}
                className="btn btn-sm btn-outline"
              >
                Add to Pipeline
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, total)} of {total} matches
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="btn btn-sm btn-outline disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
