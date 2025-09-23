import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Building2, 
  DollarSign, 
  Tag, 
  Plus,
  Eye,
  Edit,
  MoreVertical,
  Settings
} from 'lucide-react';
import { api, Job, PipelineStage } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';
import PipelineStagesManager from './PipelineStagesManager';

// Default stages will be loaded from the API

interface JobCardProps {
  job: Job;
}

function JobCard({ job }: JobCardProps) {
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
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
            {job.title}
          </h3>
          <div className="flex items-center space-x-1 ml-2">
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <Eye className="h-3 w-3" />
            </button>
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <Edit className="h-3 w-3" />
            </button>
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <MoreVertical className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center text-xs text-gray-600">
          <Building2 className="h-3 w-3 mr-1" />
          <span className="truncate">{job.client?.name || 'Unknown Client'}</span>
        </div>
        
        {(job.salary_min || job.salary_max) && (
          <div className="flex items-center text-xs text-gray-600">
            <DollarSign className="h-3 w-3 mr-1" />
            <span>
              {job.salary_min && job.salary_max
                ? `${formatCurrency(job.salary_min)} - ${formatCurrency(job.salary_max)}`
                : job.salary_min
                ? `From ${formatCurrency(job.salary_min)}`
                : `Up to ${formatCurrency(job.salary_max)}`}
            </span>
          </div>
        )}
        
        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
              >
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </span>
            ))}
            {job.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{job.tags.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface JobColumnProps {
  stage: PipelineStage;
  jobs: Job[];
}

function JobColumn({ stage, jobs }: JobColumnProps) {
  return (
    <div className="flex flex-col h-full">
      <div className={`${stage.color} ${stage.border_color} border rounded-t-lg p-3 mb-4`}>
        <h3 className="font-medium text-gray-900 text-sm">{stage.name}</h3>
        <p className="text-xs text-gray-600 mt-1">{jobs.length} jobs</p>
      </div>
      
      <div className="flex-1 min-h-0">
        <SortableContext items={jobs.map(job => job.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 h-full overflow-y-auto">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
            {jobs.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-sm">No jobs in this stage</div>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function JobPipeline() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [showStagesManager, setShowStagesManager] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadJobs(), loadStages()]);
  };

  const loadJobs = async () => {
    try {
      const response = await api.getJobs({ limit: 100 });
      setJobs(response.jobs || []);
    } catch (error) {
      toast.error('Failed to load jobs');
      console.error('Error loading jobs:', error);
    }
  };

  const loadStages = async () => {
    try {
      const stagesData = await api.getPipelineStages();
      setStages(stagesData);
    } catch (error) {
      toast.error('Failed to load pipeline stages');
      console.error('Error loading stages:', error);
    } finally {
      setLoading(false);
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
        j.id === jobId ? { ...j, status: newStage } : j
      )
    );

    try {
      // Update the job status on the backend
      await api.updateJob(jobId, { status: newStage });
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

  const getJobsByStage = (stageId: string) => {
    return jobs.filter(job => job.status === stageId);
  };

  const handleStagesUpdated = () => {
    loadStages();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs Pipeline</h2>
          <p className="text-sm text-gray-500 mt-1">
            Drag and drop jobs between stages to track their progress
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowStagesManager(true)}
            className="btn btn-outline btn-md"
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Stages
          </button>
          <Link to="/jobs/new" className="btn btn-primary btn-md">
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Link>
        </div>
      </div>

      {/* Pipeline Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid gap-4 h-[calc(100vh-200px)]`} style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
          {stages.map((stage) => (
            <JobColumn
              key={stage.id}
              stage={stage}
              jobs={getJobsByStage(stage.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Pipeline Stages Manager Modal */}
      <PipelineStagesManager
        isOpen={showStagesManager}
        onClose={() => setShowStagesManager(false)}
        onStagesUpdated={handleStagesUpdated}
      />
    </div>
  );
}
