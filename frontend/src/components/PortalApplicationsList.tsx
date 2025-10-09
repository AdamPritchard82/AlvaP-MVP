import React from 'react';
import { PortalApplication } from '../lib/api';

interface PortalApplicationsListProps {
  applications: PortalApplication[];
}

export default function PortalApplicationsList({ applications }: PortalApplicationsListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'placed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    const stageLower = stage.toLowerCase();
    if (stageLower.includes('interview')) return 'bg-yellow-100 text-yellow-800';
    if (stageLower.includes('offer')) return 'bg-green-100 text-green-800';
    if (stageLower.includes('placed')) return 'bg-blue-100 text-blue-800';
    if (stageLower.includes('sourced') || stageLower.includes('screened')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (applications.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Yet</h3>
        <p className="text-gray-500 mb-4">
          You haven't been submitted for any positions yet. Your recruitment consultant will update this when you're put forward for roles.
        </p>
        <p className="text-sm text-gray-400">
          This section will show your application history and current status once you start applying for positions.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Application History ({applications.length})
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {applications.map((application) => (
          <div key={application.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">
                    {application.jobTitle}
                  </h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                    {application.status}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-3">{application.client}</p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Stage:</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStageColor(application.stage)}`}>
                      {application.stage}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Last Update:</span>
                    <span>{formatDate(application.lastMovementDate)}</span>
                  </div>
                </div>
              </div>
              
              <div className="ml-4 flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Application ID</div>
                  <div className="text-xs font-mono text-gray-400">#{application.id}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
