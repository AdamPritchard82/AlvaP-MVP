import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Plus, Briefcase, Building, DollarSign, Tag, Calendar } from 'lucide-react';
import { api } from '../lib/api';

interface Job {
  id: string;
  title: string;
  company: string;
  clientPublicName?: string;
  salaryMin: number;
  salaryMax: number;
  location: string;
  status: string;
  tags: string[];
  createdAt: string;
  requiredSkills: {
    communications?: boolean;
    campaigns?: boolean;
    policy?: boolean;
    publicAffairs?: boolean;
  };
}

interface JobsPipelineProps {
  onCreateJob: () => void;
}

const JobsPipeline: React.FC<JobsPipelineProps> = ({ onCreateJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusColumns = [
    { id: 'New', title: 'New', color: 'bg-blue-50 border-blue-200' },
    { id: 'Reviewed', title: 'Reviewed', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'Contacted', title: 'Contacted', color: 'bg-orange-50 border-orange-200' },
    { id: 'Interviewed', title: 'Interviewed', color: 'bg-purple-50 border-purple-200' },
    { id: 'Offered', title: 'Offered', color: 'bg-green-50 border-green-200' },
    { id: 'Placed', title: 'Placed', color: 'bg-emerald-50 border-emerald-200' },
    { id: 'Rejected', title: 'Rejected', color: 'bg-red-50 border-red-200' }
  ];

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.getJobs();
      if (response.success) {
        setJobs(response.data.jobs || []);
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const jobId = draggableId;

    // Optimistic update
    const updatedJobs = jobs.map(job => 
      job.id === jobId ? { ...job, status: newStatus } : job
    );
    setJobs(updatedJobs);

    try {
      // Update backend
      await api.updateJobStatus(jobId, newStatus);
    } catch (err) {
      // Rollback on failure
      setJobs(jobs);
      console.error('Failed to update job status:', err);
    }
  };

  const formatSalary = (min: number, max: number) => {
    return `£${(min / 1000).toFixed(0)}k - £${(max / 1000).toFixed(0)}k`;
  };

  const getSkillsText = (skills: Job['requiredSkills']) => {
    const skillNames = [];
    if (skills.communications) skillNames.push('Communications');
    if (skills.campaigns) skillNames.push('Campaigns');
    if (skills.policy) skillNames.push('Policy');
    if (skills.publicAffairs) skillNames.push('Public Affairs');
    return skillNames.join(', ');
  };

  const getJobsByStatus = (status: string) => {
    return jobs.filter(job => job.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={fetchJobs}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Mobile-optimized header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Jobs Pipeline</h1>
          <p className="text-sm md:text-base text-gray-600">Manage your recruitment pipeline</p>
        </div>
        <button
          onClick={onCreateJob}
          className="flex items-center justify-center px-4 py-3 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto touch-manipulation"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="text-sm md:text-base">New Job</span>
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Mobile: Horizontal scrollable lanes */}
        <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide">
          {statusColumns.map(column => {
            const columnJobs = getJobsByStatus(column.id);
            
            return (
              <div key={column.id} className="flex-shrink-0 w-72 md:w-80">
                <div className={`rounded-lg border-2 ${column.color} p-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">{column.title}</h3>
                    <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">
                      {columnJobs.length}
                    </span>
                  </div>
                  
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-32 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-white bg-opacity-50' : ''
                        }`}
                      >
                        {columnJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`mb-3 p-3 md:p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-move touch-manipulation ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                }`}
                                onClick={() => window.location.href = `/jobs/${job.id}`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                    {job.title}
                                  </h4>
                                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                                </div>
                                
                                <div className="space-y-1.5 md:space-y-2 text-xs text-gray-600">
                                  <div className="flex items-center">
                                    <Building className="w-3 h-3 mr-1 flex-shrink-0" />
                                    <span className="truncate">{job.clientPublicName || job.company}</span>
                                  </div>
                                  
                                  <div className="flex items-center">
                                    <DollarSign className="w-3 h-3 mr-1 flex-shrink-0" />
                                    <span className="truncate">{formatSalary(job.salaryMin, job.salaryMax)}</span>
                                  </div>
                                  
                                  {job.location && (
                                    <div className="flex items-center">
                                      <Briefcase className="w-3 h-3 mr-1 flex-shrink-0" />
                                      <span className="truncate">{job.location}</span>
                                    </div>
                                  )}
                                  
                                  {getSkillsText(job.requiredSkills) && (
                                    <div className="flex items-start">
                                      <Tag className="w-3 h-3 mr-1 flex-shrink-0 mt-0.5" />
                                      <span className="truncate text-xs leading-tight">{getSkillsText(job.requiredSkills)}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {job.tags && job.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {job.tags.slice(0, 2).map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {job.tags.length > 2 && (
                                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                        +{job.tags.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {columnJobs.length === 0 && (
                          <div className="text-center text-gray-400 text-sm py-8">
                            No jobs in {column.title.toLowerCase()}
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
  );
};

export default JobsPipeline;
