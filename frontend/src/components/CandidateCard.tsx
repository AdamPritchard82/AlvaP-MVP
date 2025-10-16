import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Edit, 
  MoreVertical, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Tag, 
  AlertCircle, 
  CheckCircle,
  Trash2,
  Undo2
} from 'lucide-react';
import { Candidate } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';

interface CandidateCardProps {
  candidate: Candidate;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  isDeleting: boolean;
  isDeleted: boolean;
}

export default function CandidateCard({ 
  candidate, 
  onDelete, 
  onRestore, 
  isDeleting, 
  isDeleted 
}: CandidateCardProps) {
  const getSkillBadges = (skills: any) => {
    const activeSkills = Object.entries(skills)
      .filter(([_, active]) => active)
      .map(([skill, _]) => skill);
    
    return activeSkills.map(skill => (
      <span
        key={skill}
        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
      >
        {skill}
      </span>
    ));
  };

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
    <div className={`bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow ${
      isDeleted ? 'opacity-50 bg-gray-50' : ''
    }`}>
      {/* Header with name and actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {candidate.full_name}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {candidate.current_title || 'No title specified'}
          </p>
          {candidate.current_employer && (
            <p className="text-sm text-gray-600 truncate">
              {candidate.current_employer}
            </p>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-2 ml-3">
          <Link
            to={`/candidates/${candidate.id}`}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <Link
            to={`/candidates/${candidate.id}/edit`}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <div className="relative">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-1">
          {getSkillBadges(candidate.skills)}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center text-gray-600">
          <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
          <span className="truncate">{getSalaryRange()}</span>
        </div>
        
        <div className="flex items-center text-gray-600">
          <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
          <span className="truncate">
            {candidate.experience || 'No experience specified'}
          </span>
        </div>
        
        {candidate.email && (
          <div className="flex items-center text-gray-600 col-span-2">
            <span className="text-xs text-gray-500 mr-2">Email:</span>
            <span className="truncate">{candidate.email}</span>
          </div>
        )}
        
        {candidate.phone && (
          <div className="flex items-center text-gray-600 col-span-2">
            <span className="text-xs text-gray-500 mr-2">Phone:</span>
            <span className="truncate">{candidate.phone}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {candidate.tags && candidate.tags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {candidate.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status and actions */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-500">
          <span>Added {formatDate(candidate.created_at)}</span>
          {candidate.email_ok ? (
            <CheckCircle className="h-4 w-4 ml-2 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 ml-2 text-yellow-500" />
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {isDeleted ? (
            <button
              onClick={() => onRestore(candidate.id)}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              <Undo2 className="h-4 w-4 mr-1 inline" />
              Restore
            </button>
          ) : (
            <button
              onClick={() => onDelete(candidate.id)}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-1 inline" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
