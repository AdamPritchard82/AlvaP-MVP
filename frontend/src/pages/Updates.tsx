import React, { useState, useEffect } from 'react';
import { Activity, Clock, User, Briefcase, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { formatTime } from '../lib/utils';

interface UpdateEvent {
  id: string;
  type: 'job' | 'candidate' | 'email' | 'system';
  action: string;
  title: string;
  details: string;
  entity: {
    kind: string;
    id: number;
    name: string;
    client?: string;
  };
  timestamp: string;
  user: string;
}

export default function Updates() {
  const [events, setEvents] = useState<UpdateEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Mock data for now - this will be replaced with real API calls
  const mockEvents: UpdateEvent[] = [
    {
      id: 'evt_1',
      type: 'candidate',
      action: 'created',
      title: 'Adam entered a candidate',
      details: 'John Smith - Senior Developer',
      entity: { kind: 'candidate', id: 1, name: 'John Smith' },
      timestamp: new Date().toISOString(),
      user: 'Adam'
    },
    {
      id: 'evt_2',
      type: 'job',
      action: 'created',
      title: 'New job posted',
      details: 'Senior Press Officer @ ABI',
      entity: { kind: 'job', id: 1, name: 'Senior Press Officer', client: 'ABI' },
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      user: 'Adam'
    },
    {
      id: 'evt_3',
      type: 'candidate',
      action: 'placed',
      title: 'Bert successfully placed a candidate',
      details: 'Sarah Johnson placed in Marketing Manager role',
      entity: { kind: 'candidate', id: 2, name: 'Sarah Johnson' },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      user: 'Bert'
    },
    {
      id: 'evt_4',
      type: 'email',
      action: 'sent',
      title: 'Outreach email sent',
      details: 'Follow-up email to candidate pool',
      entity: { kind: 'email', id: 1, name: 'Candidate Outreach' },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      user: 'System'
    },
    {
      id: 'evt_5',
      type: 'system',
      action: 'digest_ready',
      title: 'Daily digest ready',
      details: '5 new candidates, 3 job applications',
      entity: { kind: 'system', id: 1, name: 'Daily Digest' },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      user: 'System'
    }
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredEvents = events.filter(event => {
    const matchesFilter = filter === 'all' || event.type === filter;
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getEventIcon = (type: string, action: string) => {
    switch (type) {
      case 'job':
        return <Briefcase className="h-5 w-5 text-blue-600" />;
      case 'candidate':
        return action === 'placed' ? 
          <CheckCircle className="h-5 w-5 text-green-600" /> : 
          <User className="h-5 w-5 text-green-600" />;
      case 'email':
        return <Mail className="h-5 w-5 text-purple-600" />;
      case 'system':
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'job': return 'bg-blue-50 border-blue-200';
      case 'candidate': return 'bg-green-50 border-green-200';
      case 'email': return 'bg-purple-50 border-purple-200';
      case 'system': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
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
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Updates
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Activity feed showing recent actions and system events
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'job', label: 'Jobs' },
              { key: 'candidate', label: 'Candidates' },
              { key: 'email', label: 'Email' },
              { key: 'system', label: 'System' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search updates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No updates found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'No activity to show yet.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`p-4 rounded-lg border ${getEventColor(event.type)} hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getEventIcon(event.type, event.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">
                      {event.title}
                    </h3>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(event.timestamp)}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {event.details}
                  </p>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span>by {event.user}</span>
                    {event.entity.kind !== 'system' && (
                      <span className="ml-2 px-2 py-1 bg-white rounded-full border">
                        View {event.entity.kind}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}



