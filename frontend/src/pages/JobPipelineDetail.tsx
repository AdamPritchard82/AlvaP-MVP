import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, User, Phone, Mail, DollarSign, Calendar, ArrowLeft, Search } from 'lucide-react';
import { api } from '../lib/api';

interface Job {
  id: string;
  title: string;
  company: string;
  clientPublicName?: string;
  salaryMin: number;
  salaryMax: number;
  location: string;
  description: string;
  requiredSkills: {
    communications?: boolean;
    campaigns?: boolean;
    policy?: boolean;
    publicAffairs?: boolean;
  };
  tags: string[];
  createdAt: string;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentEmployer: string;
  salaryMin: number;
  salaryMax: number;
  skills: {
    communications?: boolean;
    campaigns?: boolean;
    policy?: boolean;
    publicAffairs?: boolean;
  };
  matchScore?: number;
  stage: string;
  attachedAt: string;
}

interface JobPipelineDetailProps {
  onAddCandidate: (candidateId: string) => void;
}

const JobPipelineDetail: React.FC<JobPipelineDetailProps> = ({ onAddCandidate }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);

  const pipelineStages = [
    { id: 'New', title: 'New', color: 'bg-blue-50 border-blue-200' },
    { id: 'Contacted', title: 'Contacted', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'Interviewed', title: 'Interviewed', color: 'bg-purple-50 border-purple-200' },
    { id: 'Offered', title: 'Offered', color: 'bg-green-50 border-green-200' },
    { id: 'Placed', title: 'Placed', color: 'bg-emerald-50 border-emerald-200' },
    { id: 'Rejected', title: 'Rejected', color: 'bg-red-50 border-red-200' }
  ];

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchJobCandidates();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await api.getJob(jobId!);
      if (response.success) {
        setJob(response.data);
      } else {
        setError('Failed to load job details');
      }
    } catch (err) {
      setError('Failed to load job details');
      console.error('Error fetching job:', err);
    }
  };

  const fetchJobCandidates = async () => {
    try {
      const response = await api.getJobPipelineMatches(jobId!);
      if (response.success) {
        setCandidates(response.data.candidates || []);
      } else {
        setError('Failed to load candidates');
      }
    } catch (err) {
      setError('Failed to load candidates');
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    const candidateId = draggableId;

    // Optimistic update
    const updatedCandidates = candidates.map(candidate => 
      candidate.id === candidateId ? { ...candidate, stage: newStage } : candidate
    );
    setCandidates(updatedCandidates);

    try {
      // Update backend
      await api.updateMatchStage(candidateId, newStage);
    } catch (err) {
      // Rollback on failure
      setCandidates(candidates);
      console.error('Failed to update candidate stage:', err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.searchCandidates(query);
      if (response.success) {
        setSearchResults(response.data.candidates || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleAddCandidate = async (candidateId: string) => {
    try {
      await api.addJobPipelineMatch(jobId!, candidateId);
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchJobCandidates(); // Refresh the list
    } catch (err) {
      console.error('Failed to add candidate:', err);
    }
  };

  const formatSalary = (min: number, max: number) => {
    return `£${(min / 1000).toFixed(0)}k - £${(max / 1000).toFixed(0)}k`;
  };

  const getSkillsText = (skills: any) => {
    const skillNames = [];
    if (skills.communications) skillNames.push('Communications');
    if (skills.campaigns) skillNames.push('Campaigns');
    if (skills.policy) skillNames.push('Policy');
    if (skills.publicAffairs) skillNames.push('Public Affairs');
    return skillNames.join(', ');
  };

  const getCandidatesByStage = (stage: string) => {
    return candidates.filter(candidate => candidate.stage === stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
        <button 
          onClick={() => navigate('/jobs')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Job Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </button>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <p className="text-lg text-gray-600">{job.clientPublicName || job.company}</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{job.location}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <span className="mr-2">Skills:</span>
              <span>{getSkillsText(job.requiredSkills)}</span>
            </div>
          </div>
          
          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {job.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Candidate Pipeline */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Candidate Pipeline</h2>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex space-x-4 overflow-x-auto pb-4">
            {pipelineStages.map(stage => {
              const stageCandidates = getCandidatesByStage(stage.id);
              
              return (
                <div key={stage.id} className="flex-shrink-0 w-80">
                  <div className={`rounded-lg border-2 ${stage.color} p-4`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">{stage.title}</h3>
                      <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">
                        {stageCandidates.length}
                      </span>
                    </div>
                    
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-32 transition-colors ${
                            snapshot.isDraggingOver ? 'bg-white bg-opacity-50' : ''
                          }`}
                        >
                          {stageCandidates.map((candidate, index) => (
                            <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-3 p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-move ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-medium text-gray-900 text-sm">
                                      {candidate.firstName} {candidate.lastName}
                                    </h4>
                                    {candidate.matchScore && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        {candidate.matchScore}% match
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex items-center">
                                      <Mail className="w-3 h-3 mr-1" />
                                      <span className="truncate">{candidate.email}</span>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <User className="w-3 h-3 mr-1" />
                                      <span>{candidate.currentTitle}</span>
                                    </div>
                                    
                                    <div className="flex items-center">
                                      <DollarSign className="w-3 h-3 mr-1" />
                                      <span>{formatSalary(candidate.salaryMin, candidate.salaryMax)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {stageCandidates.length === 0 && (
                            <div className="text-center text-gray-400 text-sm py-8">
                              No candidates in {stage.title.toLowerCase()}
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Candidate to Pipeline</h3>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map(candidate => (
                <div
                  key={candidate.id}
                  className="p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleAddCandidate(candidate.id)}
                >
                  <div className="font-medium text-sm">
                    {candidate.firstName} {candidate.lastName}
                  </div>
                  <div className="text-xs text-gray-600">
                    {candidate.currentTitle} at {candidate.currentEmployer}
                  </div>
                </div>
              ))}
              
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-4">
                  No candidates found
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPipelineDetail;
