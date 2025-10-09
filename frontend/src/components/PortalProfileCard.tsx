import React from 'react';
import { PortalProfile } from '../lib/api';

interface PortalProfileCardProps {
  profile: PortalProfile;
}

export default function PortalProfileCard({ profile }: PortalProfileCardProps) {
  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Not specified';
    if (!max) return `£${min?.toLocaleString()}+`;
    return `£${min?.toLocaleString()} - £${max?.toLocaleString()}`;
  };

  const formatSkills = (skills: any) => {
    const skillNames = {
      communications: 'Communications',
      campaigns: 'Campaigns',
      policy: 'Policy',
      publicAffairs: 'Public Affairs'
    };

    return Object.entries(skills)
      .filter(([_, level]) => level && level > 0)
      .map(([key, level]) => `${skillNames[key as keyof typeof skillNames]} (${level}/5)`)
      .join(', ') || 'No skills specified';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-gray-600">{profile.currentTitle}</p>
            <p className="text-gray-500">{profile.currentEmployer}</p>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-500">Email:</span>
              <p className="text-gray-900">{profile.email}</p>
            </div>
            {profile.phone && (
              <div>
                <span className="text-sm font-medium text-gray-500">Phone:</span>
                <p className="text-gray-900">{profile.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Skills and Salary */}
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Skills:</span>
            <p className="text-gray-900 mt-1">{formatSkills(profile.skills)}</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Salary Range:</span>
            <p className="text-gray-900">{formatSalary(profile.salaryMin, profile.salaryMax)}</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Last Updated:</span>
            <p className="text-gray-900">{formatDate(profile.lastUpdated)}</p>
          </div>
        </div>
      </div>

      {/* Skills Visualization */}
      {Object.keys(profile.skills).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Skill Levels</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(profile.skills).map(([skill, level]) => {
              if (!level || level <= 0) return null;
              
              const skillNames = {
                communications: 'Communications',
                campaigns: 'Campaigns',
                policy: 'Policy',
                publicAffairs: 'Public Affairs'
              };

              return (
                <div key={skill} className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {skillNames[skill as keyof typeof skillNames]}
                  </div>
                  <div className="flex justify-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`w-3 h-3 rounded-full ${
                          star <= level ? 'bg-blue-500' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{level}/5</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
