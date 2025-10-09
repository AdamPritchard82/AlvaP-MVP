import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, PortalProfile, PortalApplication } from '../lib/api';
import PortalProfileCard from '../components/PortalProfileCard';
import PortalApplicationsList from '../components/PortalApplicationsList';
import PortalError from '../components/PortalError';

export default function Portal() {
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [applications, setApplications] = useState<PortalApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      setError('No portal access token provided. Please use the link sent to you.');
      setLoading(false);
      return;
    }

    setToken(tokenFromUrl);
    loadPortalData(tokenFromUrl);
  }, [searchParams]);

  const loadPortalData = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load profile and applications in parallel
      const [profileResponse, applicationsResponse] = await Promise.all([
        api.getPortalProfile(token),
        api.getPortalApplications(token)
      ]);

      if (profileResponse.success) {
        setProfile(profileResponse.profile);
      } else {
        setError('Failed to load your profile. Please try again later.');
      }

      if (applicationsResponse.success) {
        setApplications(applicationsResponse.applications);
      } else {
        setError('Failed to load your applications. Please try again later.');
      }
    } catch (err) {
      console.error('Portal data loading error:', err);
      setError('Unable to load your portal data. Please check your link and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <PortalError error={error} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Candidate Portal</h1>
              <p className="text-gray-600 mt-1">View your profile and application status</p>
            </div>
            <div className="text-sm text-gray-500">
              Powered by <span className="font-semibold text-blue-600">AlvaP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Profile Section */}
          {profile && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Profile</h2>
              <PortalProfileCard profile={profile} />
            </div>
          )}

          {/* Applications Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Applications</h2>
            <PortalApplicationsList applications={applications} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>© 2024 AlvaP. All rights reserved.</p>
            <p className="mt-1">
              Questions? Contact your recruitment consultant or{' '}
              <a href="mailto:support@alvap.com" className="text-blue-600 hover:text-blue-800">
                support@alvap.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
