import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  User, 
  Briefcase, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Filter,
  Search,
  Plus,
  ExternalLink,
  Users,
  Calendar,
  DollarSign,
  MapPin,
  Tag
} from 'lucide-react';
import { formatTime } from '../lib/utils';
import { api } from '../lib/api';

// Types
interface Event {
  id: string;
  type: 'job:new' | 'job:update' | 'candidate:update' | 'client:update';
  title: string;
  summary: string;
  jobId?: string;
  clientId?: string;
  candidateId?: string;
  createdAt: string;
  priority?: 'low' | 'normal' | 'high';
  source?: string;
  assignedTo?: string;
  assignedUserName?: string;
  job?: {
    id: string;
    title: string;
    salaryMin?: number;
    salaryMax?: number;
    tags: string[];
    source?: string;
  };
  client?: {
    id: string;
    name: string;
    logo?: string;
  };
}

interface OpenRole {
  id: string;
  title: string;
  salaryMin?: number;
  salaryMax?: number;
  tags: string[];
  source?: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    logo?: string;
  };
  stage: {
    id: string;
    name: string;
    color: string;
  };
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  border_color: string;
  position: number;
}

export default function UpdatesAndOpenRoles() {
  const [events, setEvents] = useState<Event[]>([]);
  const [openRoles, setOpenRoles] = useState<OpenRole[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [filter, setFilter] = useState<'all' | 'new-roles'>('all');
  const [assignedTo, setAssignedTo] = useState<'all' | 'me'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | '7d' | '30d'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load data
  useEffect(() => {
    loadData();
  }, [filter, assignedTo, timeFilter]);

  // Load unread count
  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const since = getSinceDate(timeFilter);
      
      if (filter === 'new-roles') {
        // Load only new roles
        const [eventsData, rolesData] = await Promise.all([
          api.getEvents({ 
            filter: 'new-roles', 
            assignedTo, 
            since, 
            limit: 50 
          }),
          api.getOpenRoles({ 
            assignedTo, 
            since, 
            limit: 50 
          })
        ]);
        
        setEvents(eventsData.events || []);
        setOpenRoles(rolesData.jobs || []);
      } else {
        // Load all events
        const eventsData = await api.getEvents({ 
          filter: 'all', 
          assignedTo, 
          since, 
          limit: 50 
        });
        
        setEvents(eventsData.events || []);
        setOpenRoles([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const lastVisit = localStorage.getItem('lastVisit') || new Date().toISOString();
      const data = await api.getUnreadCount(lastVisit);
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadPipelineStages = async () => {
    try {
      const data = await api.getPipelineStages();
      setPipelineStages(data || []);
    } catch (error) {
      console.error('Error loading pipeline stages:', error);
    }
  };

  const getSinceDate = (timeFilter: string) => {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const handleAssignToMe = async (jobId: string) => {
    try {
      await api.assignJob(jobId, 'me'); // In real implementation, use actual user ID
      await loadData();
    } catch (error) {
      console.error('Error assigning job:', error);
    }
  };

  const handleOpenInJobs = (jobId: string) => {
    window.open(`/jobs/${jobId}`, '_blank');
  };

  const handleStageChange = async (jobId: string, newStageId: string) => {
    try {
      await api.updateJob(jobId, { status: newStageId });
      await loadData();
    } catch (error) {
      console.error('Error updating job stage:', error);
    }
  };

  // Filter events based on search
  const filteredEvents = events.filter(event => 
    !searchTerm || 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.job?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOpenRoles = openRoles.filter(role =>
    !searchTerm ||
    role.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Mark as read when component mounts
  useEffect(() => {
    localStorage.setItem('lastVisit', new Date().toISOString());
    setUnreadCount(0);
  }, []);

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
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Updates & Open Roles
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Activity feed and real-time job alerts
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Filter toggles */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All updates
            </button>
            <button
              onClick={() => setFilter('new-roles')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === 'new-roles'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Only new roles
            </button>
          </div>

          {/* Assignment filter */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value as 'all' | 'me')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="all">All clients</option>
              <option value="me">My clients only</option>
            </select>
          </div>

          {/* Time filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as 'today' | '7d' | '30d')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="today">Today</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search updates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {filter === 'all' ? (
        <EventsFeed events={filteredEvents} onAssignToMe={handleAssignToMe} onOpenInJobs={handleOpenInJobs} />
      ) : (
        <OpenRolesFeed 
          roles={filteredOpenRoles} 
          onAssignToMe={handleAssignToMe} 
          onOpenInJobs={handleOpenInJobs}
          onStageChange={handleStageChange}
          pipelineStages={pipelineStages}
        />
      )}
    </div>
  );
}

// Events Feed Component
function EventsFeed({ 
  events, 
  onAssignToMe, 
  onOpenInJobs 
}: { 
  events: Event[];
  onAssignToMe: (jobId: string) => void;
  onOpenInJobs: (jobId: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Quiet here</h3>
        <p className="mt-1 text-sm text-gray-500">You're all caught up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard 
          key={event.id} 
          event={event} 
          onAssignToMe={onAssignToMe} 
          onOpenInJobs={onOpenInJobs} 
        />
      ))}
    </div>
  );
}

// Open Roles Feed Component
function OpenRolesFeed({ 
  roles, 
  onAssignToMe, 
  onOpenInJobs, 
  onStageChange,
  pipelineStages 
}: { 
  roles: OpenRole[];
  onAssignToMe: (jobId: string) => void;
  onOpenInJobs: (jobId: string) => void;
  onStageChange: (jobId: string, stageId: string) => void;
  pipelineStages: PipelineStage[];
}) {
  if (roles.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No new roles right now</h3>
        <p className="mt-1 text-sm text-gray-500">Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <OpenRoleCard 
          key={role.id} 
          role={role} 
          onAssignToMe={onAssignToMe} 
          onOpenInJobs={onOpenInJobs}
          onStageChange={onStageChange}
          pipelineStages={pipelineStages}
        />
      ))}
    </div>
  );
}

// Event Card Component
function EventCard({ 
  event, 
  onAssignToMe, 
  onOpenInJobs 
}: { 
  event: Event;
  onAssignToMe: (jobId: string) => void;
  onOpenInJobs: (jobId: string) => void;
}) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'job:new':
        return <Briefcase className="h-5 w-5 text-green-500" />;
      case 'job:update':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'candidate:update':
        return <User className="h-5 w-5 text-purple-500" />;
      case 'client:update':
        return <Users className="h-5 w-5 text-orange-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'normal':
        return 'border-l-blue-500';
      case 'low':
        return 'border-l-gray-500';
      default:
        return 'border-l-gray-300';
    }
  };

  return (
    <div className={`bg-white rounded-lg border-l-4 ${getPriorityColor(event.priority)} border border-gray-200 p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0">
            {getEventIcon(event.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">{event.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{event.summary}</p>
            
            {/* Job details for new roles */}
            {event.type === 'job:new' && event.job && (
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                {event.job.salaryMin && (
                  <div className="flex items-center">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {event.job.salaryMin}{event.job.salaryMax ? `-${event.job.salaryMax}` : '+'}
                  </div>
                )}
                {event.job.tags.length > 0 && (
                  <div className="flex items-center">
                    <Tag className="h-3 w-3 mr-1" />
                    {event.job.tags.slice(0, 2).join(', ')}
                  </div>
                )}
                {event.job.source && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {event.job.source}
                  </span>
                )}
              </div>
            )}

            {/* Client info */}
            {event.client && (
              <div className="mt-2 flex items-center text-xs text-gray-500">
                <div className="flex items-center">
                  {event.client.logo ? (
                    <img 
                      src={event.client.logo} 
                      alt={event.client.name}
                      className="h-4 w-4 rounded mr-2"
                    />
                  ) : (
                    <div className="h-4 w-4 bg-gray-200 rounded mr-2 flex items-center justify-center text-xs font-medium">
                      {event.client.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {event.client.name}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <span className="text-xs text-gray-400">{formatTime(event.createdAt)}</span>
          
          {/* Actions for new roles */}
          {event.type === 'job:new' && event.jobId && (
            <div className="flex space-x-1">
              <button
                onClick={() => onAssignToMe(event.jobId!)}
                className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200"
              >
                Assign to me
              </button>
              <button
                onClick={() => onOpenInJobs(event.jobId!)}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
              >
                Open in Jobs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Open Role Card Component
function OpenRoleCard({ 
  role, 
  onAssignToMe, 
  onOpenInJobs, 
  onStageChange,
  pipelineStages 
}: { 
  role: OpenRole;
  onAssignToMe: (jobId: string) => void;
  onOpenInJobs: (jobId: string) => void;
  onStageChange: (jobId: string, stageId: string) => void;
  pipelineStages: PipelineStage[];
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0">
            {role.client.logo ? (
              <img 
                src={role.client.logo} 
                alt={role.client.name}
                className="h-8 w-8 rounded"
              />
            ) : (
              <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center text-sm font-medium">
                {role.client.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900">{role.title}</h3>
            <p className="text-sm text-gray-500">{role.client.name}</p>
            
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              {role.salaryMin && (
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  {role.salaryMin}{role.salaryMax ? `-${role.salaryMax}` : '+'}
                </div>
              )}
              {role.tags.length > 0 && (
                <div className="flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  {role.tags.slice(0, 3).join(', ')}
                </div>
              )}
              {role.source && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {role.source}
                </span>
              )}
            </div>

            {/* Current stage */}
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${role.stage.color} text-gray-800`}>
                {role.stage.name}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <span className="text-xs text-gray-400">{formatTime(role.createdAt)}</span>
          
          <div className="flex space-x-1">
            <button
              onClick={() => onAssignToMe(role.id)}
              className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200"
            >
              Assign to me
            </button>
            <button
              onClick={() => onOpenInJobs(role.id)}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
            >
              Open in Jobs
            </button>
          </div>
        </div>
      </div>

      {/* Stage change dropdown */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Move to:</span>
          <select
            value={role.stage.id}
            onChange={(e) => onStageChange(role.id, e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            {pipelineStages.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}










