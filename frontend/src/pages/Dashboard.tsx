import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  Activity, 
  TrendingUp, 
  Plus,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { api, Candidate, Job, Match } from '../lib/api';
import { formatDate } from '../lib/utils';

interface DashboardStats {
  totalCandidates: number;
  totalJobs: number;
  totalUpdates: number;
  activeJobs: number;
  newUpdates: number;
  recentActivity: Array<{
    id: string;
    type: 'candidate' | 'job' | 'match';
    action: string;
    created_at: string;
  }>;
}

export default function Dashboard() {
  console.log('Dashboard component rendering');
  const [stats, setStats] = useState<DashboardStats | null>({
    totalCandidates: 12,
    totalJobs: 8,
    totalUpdates: 0,
    activeJobs: 5,
    newUpdates: 0,
    recentActivity: []
  });
  const [recentCandidates, setRecentCandidates] = useState<Candidate[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch real data from backend
      const [candidates, jobs] = await Promise.all([
        api.getCandidates({ limit: 5 }),
        api.getJobs({ limit: 5 })
      ]);

      setRecentCandidates(candidates.candidates || []);
      setRecentJobs(jobs.jobs || []);
      
      setStats({
        totalCandidates: candidates.total || 0,
        totalJobs: jobs.total || 0,
        totalUpdates: 0,
        activeJobs: jobs.jobs?.filter(j => j.status === 'active').length || 0,
        newUpdates: 0,
        recentActivity: []
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Fallback to mock data if backend fails
      setStats({
        totalCandidates: 12,
        totalJobs: 8,
        totalUpdates: 0,
        activeJobs: 5,
        newUpdates: 0,
        recentActivity: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Candidates',
      value: stats?.totalCandidates || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      href: '/candidates'
    },
    {
      name: 'Active Jobs',
      value: stats?.activeJobs || 0,
      icon: Briefcase,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/jobs'
    },
    {
      name: 'Recent Updates',
      value: '5',
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/updates'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back! Here's what's happening with your recruitment pipeline.
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <Link
            to="/candidates"
            className="btn btn-outline btn-md"
          >
            <Users className="h-4 w-4 mr-2" />
            Candidates
          </Link>
          <Link
            to="/candidates/new"
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Candidate
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.name}
            to={card.href}
            className="card p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {card.name}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {card.value}
                  </dd>
                </dl>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/candidates"
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300"
          >
            <div>
              <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                <Users className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <span className="absolute inset-0" />
                Candidates
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Browse and manage your candidate database
              </p>
            </div>
          </Link>

          <Link
            to="/jobs"
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300"
          >
            <div>
              <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                <Briefcase className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <span className="absolute inset-0" />
                Jobs
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                View and manage your job pipeline
              </p>
            </div>
          </Link>

          <Link
            to="/clients"
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300"
          >
            <div>
              <span className="rounded-lg inline-flex p-3 bg-orange-50 text-orange-700 ring-4 ring-white">
                <Briefcase className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <span className="absolute inset-0" />
                Clients
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                View and manage client organizations
              </p>
            </div>
          </Link>

          <Link
            to="/updates"
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300"
          >
            <div>
              <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                <Activity className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <span className="absolute inset-0" />
                Updates
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                View recent activity and system events
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Candidates */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Candidates</h3>
            <Link to="/candidates" className="text-sm text-primary-600 hover:text-primary-500">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentCandidates.length === 0 ? (
              <p className="text-sm text-gray-500">No candidates yet</p>
            ) : (
              recentCandidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {candidate.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {candidate.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {candidate.current_title || 'No title'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatDate(candidate.created_at)}
                    </span>
                    <Link
                      to={`/candidates/${candidate.id}`}
                      className="text-primary-600 hover:text-primary-500"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Jobs</h3>
            <Link to="/jobs" className="text-sm text-primary-600 hover:text-primary-500">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-gray-500">No jobs yet</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {job.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {job.client?.name || 'No client'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'active' ? 'bg-green-100 text-green-800' :
                      job.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-primary-600 hover:text-primary-500"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


