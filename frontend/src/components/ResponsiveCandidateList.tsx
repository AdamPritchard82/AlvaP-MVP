import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Edit, 
  AlertCircle, 
  CheckCircle,
  Trash2,
  Undo2
} from 'lucide-react';
import { Candidate } from '../lib/api';
import CandidateCard from './CandidateCard';
import { formatCurrency } from '../lib/utils';

interface ResponsiveCandidateListProps {
  candidates: Candidate[];
  loading: boolean;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  deletingCandidate: string | null;
  deletedCandidates: Set<string>;
}

export default function ResponsiveCandidateList({
  candidates,
  loading,
  onDelete,
  onRestore,
  deletingCandidate,
  deletedCandidates
}: ResponsiveCandidateListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search criteria or add a new candidate.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View - visible on small screens */}
      <div className="block md:hidden">
        {candidates.map(candidate => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onDelete={onDelete}
            onRestore={onRestore}
            isDeleting={deletingCandidate === candidate.id}
            isDeleted={deletedCandidates.has(candidate.id)}
          />
        ))}
      </div>

      {/* Desktop Table View - visible on medium screens and up */}
      <div className="hidden md:block overflow-hidden">
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
                Salary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Experience
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {candidates.map(candidate => {
              const activeSkills = Object.entries(candidate.skills)
                .filter(([_, active]) => active)
                .map(([skill, _]) => skill);

              const getSalaryRange = () => {
                if (candidate.salary_min && candidate.salary_max) {
                  return `${formatCurrency(candidate.salary_min)} - ${formatCurrency(candidate.salary_max)}`;
                } else if (candidate.salary_min) {
                  return `From ${formatCurrency(candidate.salary_min)}`;
                } else if (candidate.salary_max) {
                  return `Up to ${formatCurrency(candidate.salary_max)}`;
                }
                return 'Not specified';
              };

              return (
                <tr 
                  key={candidate.id}
                  className={`hover:bg-gray-50 ${deletedCandidates.has(candidate.id) ? 'opacity-50 bg-gray-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {candidate.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {candidate.current_title || 'No title specified'}
                        </div>
                        {candidate.current_employer && (
                          <div className="text-xs text-gray-400">
                            {candidate.current_employer}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {activeSkills.map(skill => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getSalaryRange()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {candidate.experience || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {candidate.email_ok ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="ml-2 text-sm text-gray-500">
                        {candidate.email_ok ? 'Email OK' : 'Email Pending'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/candidates/${candidate.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/candidates/${candidate.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      {deletedCandidates.has(candidate.id) ? (
                        <button
                          onClick={() => onRestore(candidate.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onDelete(candidate.id)}
                          disabled={deletingCandidate === candidate.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
