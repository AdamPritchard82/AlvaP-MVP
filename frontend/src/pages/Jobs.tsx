import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Filter, Search, BarChart3, Users, Clock, CheckCircle, XCircle, AlertCircle, GripVertical, MoreVertical, Edit, Trash2, Eye, ArrowRight } from 'lucide-react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent, DragEndEvent, DragOverEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, Job, PipelineStage } from '../lib/api';
import { useUsage } from '../hooks/useUsage';
import { UsageLimitPrompt } from '../components/UpgradePrompt';
import toast from 'react-hot-toast';

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  jobs: Job[];
  count: number;
}

// Job Actions Menu Component
function JobActionsMenu({ job, onEdit, onDelete, onView }: { 
  job: Job; 
  onEdit: (job: Job) => void; 
  onDelete: (job: Job) => void; 
  onView: (job: Job) => void; 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-gray-100 rounded"
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      >
        <MoreVertical className="h-3 w-3 text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
          <button
            onClick={() => { onView(job); setIsOpen(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <Eye className="h-3 w-3 mr-2" />
            View
          </button>
          <button
            onClick={() => { onEdit(job); setIsOpen(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <Edit className="h-3 w-3 mr-2" />
            Edit
          </button>
          <button
            onClick={() => { onDelete(job); setIsOpen(false); }}
            className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Sortable Job Card Component
function SortableJobCard({ 
  job, 
  stageId, 
  onEdit, 
  onDelete, 
  onView 
}: { 
  job: Job; 
  stageId: string; 
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onView: (job: Job) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg p-3 shadow-sm border hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm text-gray-900 line-clamp-2 flex-1">
            {job.title}
          </h4>
          <div className="flex items-center gap-1">
            <JobActionsMenu 
              job={job} 
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
            <div
              {...attributes}
              {...listeners}
              className="p-1 cursor-grab hover:bg-gray-100 rounded"
            >
              <GripVertical className="h-3 w-3 text-gray-400" />
            </div>
          </div>
        </div>
        {job.client && (
          <p className="text-xs text-gray-500">{job.client.name}</p>
        )}
        {job.salary_min && job.salary_max && (
          <p className="text-xs text-gray-600">
            £{job.salary_min.toLocaleString()} - £{job.salary_max.toLocaleString()}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {job.tags.slice(0, 2).map((tag, index) => (
            <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {tag}
            </span>
          ))}
          {job.tags.length > 2 && (
            <span className="text-xs text-gray-400">+{job.tags.length - 2}</span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {new Date(job.updated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// Funnel Stage Column Component
function FunnelStageColumn({ 
  stage, 
  jobs, 
  onEdit, 
  onDelete, 
  onView 
}: { 
  stage: FunnelStage; 
  jobs: Job[];
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onView: (job: Job) => void;
}) {
  return (
    <div className={`${stage.color} ${stage.borderColor} border-2 rounded-lg p-4 min-h-[400px]`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{stage.name}</h3>
        <span className="bg-white text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
          {stage.count}
        </span>
      </div>
      
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No jobs in this stage</p>
          </div>
        ) : (
          <SortableContext items={jobs.map(job => job.id)} strategy={verticalListSortingStrategy}>
            {jobs.map((job) => (
              <SortableJobCard 
                key={job.id} 
                job={job} 
                stageId={stage.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const { usage, isLimitReached, getUsagePercentage } = useUsage();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadJobs(), loadPipelineStages()]);
  };

  const loadJobs = async () => {
    try {
      const response = await api.getJobs({ limit: 1000 });
      setJobs(response.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPipelineStages = async () => {
    try {
      const stages = await api.getPipelineStages();
      setPipelineStages(stages || []);
    } catch (error) {
      console.error('Failed to load pipeline stages:', error);
      // Set default stages if API fails
      setPipelineStages([
        { id: 'New', name: 'New', color: 'bg-blue-50', border_color: 'border-blue-200', position: 1, is_default: true, is_first: true, created_at: '', updated_at: '' },
        { id: 'Reviewed', name: 'Reviewed', color: 'bg-yellow-50', border_color: 'border-yellow-200', position: 2, is_default: false, is_first: false, created_at: '', updated_at: '' },
        { id: 'Contacted', name: 'Contacted', color: 'bg-orange-50', border_color: 'border-orange-200', position: 3, is_default: false, is_first: false, created_at: '', updated_at: '' },
        { id: 'Interviewed', name: 'Interviewed', color: 'bg-purple-50', border_color: 'border-purple-200', position: 4, is_default: false, is_first: false, created_at: '', updated_at: '' },
        { id: 'Offered', name: 'Offered', color: 'bg-green-50', border_color: 'border-green-200', position: 5, is_default: false, is_first: false, created_at: '', updated_at: '' },
        { id: 'Placed', name: 'Placed', color: 'bg-emerald-50', border_color: 'border-emerald-200', position: 6, is_default: false, is_first: false, created_at: '', updated_at: '' },
        { id: 'Rejected', name: 'Rejected', color: 'bg-red-50', border_color: 'border-red-200', position: 7, is_default: false, is_first: false, created_at: '', updated_at: '' }
      ]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const job = jobs.find(j => j.id === active.id);
    setActiveJob(job || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const jobId = active.id as string;
    const newStage = over.id as string;

    // Find the job and check if it's actually changing stages
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status === newStage) return;

    // Optimistically update the UI
    setJobs(prevJobs => 
      prevJobs.map(j => 
        j.id === jobId ? { ...j, status: newStage as any } : j
      )
    );

    try {
      // Update the job status on the backend
      await api.updateJobStatus(jobId, newStage);
      toast.success('Job moved successfully');
    } catch (error) {
      // Revert the optimistic update on error
      setJobs(prevJobs => 
        prevJobs.map(j => 
          j.id === jobId ? { ...j, status: job.status } : j
        )
      );
      toast.error('Failed to update job status');
      console.error('Error updating job:', error);
    }
  };

  const handleEditJob = (job: Job) => {
    // Navigate to edit job page
    window.location.href = `/jobs/edit/${job.id}`;
  };

  const handleDeleteJob = async (job: Job) => {
    if (window.confirm(`Are you sure you want to delete "${job.title}"?`)) {
      try {
        await api.deleteJob(job.id);
        setJobs(prevJobs => prevJobs.filter(j => j.id !== job.id));
        toast.success('Job deleted successfully');
      } catch (error) {
        toast.error('Failed to delete job');
        console.error('Error deleting job:', error);
      }
    }
  };

  const handleViewJob = (job: Job) => {
    // Navigate to job details page
    navigate(`/jobs/${job.id}`);
  };

  // Filter jobs based on search and client selection
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = !selectedClient || job.client_id === selectedClient;
    return matchesSearch && matchesClient;
  });

  // Group jobs by stage
  const stagesWithJobs: FunnelStage[] = pipelineStages.map(stage => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    borderColor: stage.border_color,
    jobs: filteredJobs.filter(job => job.status === stage.id),
    count: filteredJobs.filter(job => job.status === stage.id).length
  }));

  // Calculate funnel metrics
  const totalJobs = filteredJobs.length;
  const placedJobs = stagesWithJobs.find(s => s.id === 'placed')?.count || 0;
  const conversionRate = totalJobs > 0 ? ((placedJobs / totalJobs) * 100).toFixed(1) : '0';

  // Get unique clients for filter
  const clients = Array.from(new Set(jobs.map(job => job.client).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Limits */}
      {usage && (
        <>
          {isLimitReached('jobs') && (
            <UsageLimitPrompt
              resource="jobs"
              current={usage.current.jobs}
              limit={usage.limits.jobs}
              className="mb-6"
            />
          )}
          
          {getUsagePercentage('jobs') >= 75 && !isLimitReached('jobs') && (
            <UsageLimitPrompt
              resource="jobs"
              current={usage.current.jobs}
              limit={usage.limits.jobs}
              className="mb-6"
            />
          )}
        </>
      )}

      {/* Header with Analytics */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs Funnel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track job opportunities through your recruitment pipeline
          </p>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Job
        </Link>
      </div>

      {/* Funnel Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{totalJobs}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Placed</p>
              <p className="text-2xl font-bold text-gray-900">{placedJobs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Pipeline</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalJobs - placedJobs - (stagesWithJobs.find(s => s.id === 'rejected')?.count || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Quick Actions */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search jobs or clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Clients</option>
                  {clients.map(client => (
                    <option key={client?.id} value={client?.id}>{client?.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextStage = (stage: string) => {
                  const stages = ['discovered', 'researching', 'approaching', 'in_discussion', 'commissioned', 'interview_stage_1', 'interview_stage_2', 'offered', 'placed'];
                  const currentIndex = stages.indexOf(stage);
                  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : stage;
                };
                
                const jobsToMove = filteredJobs.filter(job => 
                  job.status !== 'placed' && job.status !== 'rejected'
                );
                
                if (jobsToMove.length > 0) {
                  const confirmMove = window.confirm(
                    `Move ${jobsToMove.length} jobs to their next stage?`
                  );
                  if (confirmMove) {
                    jobsToMove.forEach(async (job) => {
                      const newStage = nextStage(job.status);
                      if (newStage !== job.status) {
                        try {
                          await api.updateJobStatus(job.id, newStage);
                          setJobs(prevJobs => 
                            prevJobs.map(j => 
                              j.id === job.id ? { ...j, status: newStage as any } : j
                            )
                          );
                        } catch (error) {
                          console.error('Error updating job:', error);
                        }
                      }
                    });
                    toast.success(`Moved ${jobsToMove.length} jobs forward`);
                  }
                }
              }}
              className="btn btn-outline btn-sm"
              disabled={filteredJobs.filter(job => job.status !== 'placed' && job.status !== 'rejected').length === 0}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Move All Forward
            </button>
          </div>
        </div>
      </div>

      {/* Funnel Stages */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
          {stagesWithJobs.map((stage) => (
            <div key={stage.id} data-stage={stage.id}>
              <FunnelStageColumn 
                stage={stage} 
                jobs={stage.jobs}
                onEdit={handleEditJob}
                onDelete={handleDeleteJob}
                onView={handleViewJob}
              />
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeJob ? (
            <div className="bg-white rounded-lg p-3 shadow-lg border max-w-xs">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                  {activeJob.title}
                </h4>
                {activeJob.client && (
                  <p className="text-xs text-gray-500">{activeJob.client.name}</p>
                )}
                {activeJob.salary_min && activeJob.salary_max && (
                  <p className="text-xs text-gray-600">
                    £{activeJob.salary_min.toLocaleString()} - £{activeJob.salary_max.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty State */}
      {totalJobs === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || selectedClient 
              ? 'Try adjusting your filters to see more jobs.'
              : 'Get started by adding your first job opportunity.'
            }
          </p>
          <Link to="/jobs/new" className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Job
          </Link>
        </div>
      )}
    </div>
  );
}


