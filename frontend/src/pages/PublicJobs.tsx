import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, PublicJob } from '../lib/api';
import { Search, Filter, MapPin, Clock, DollarSign, Building2, Briefcase } from 'lucide-react';

export default function PublicJobs() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    skill: '',
    band: '',
    location: '',
    employmentType: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadJobs();
  }, [filters, pagination.page]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await api.getPublicJobs({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters
      });
      
      if (response.success) {
        setJobs(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      skill: '',
      band: '',
      location: '',
      employmentType: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatSalary = (min: number, max: number) => {
    return `£${min.toLocaleString()} - £${max.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSkillNames = (skills: any) => {
    const skillNames = {
      communications: 'Communications',
      campaigns: 'Campaigns',
      policy: 'Policy',
      publicAffairs: 'Public Affairs'
    };

    return Object.entries(skills)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => skillNames[key as keyof typeof skillNames])
      .join(', ');
  };

  const getBandOptions = () => {
    const bands = [];
    for (let i = 30; i <= 200; i += 10) {
      bands.push(i * 1000);
    }
    return bands;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job Opportunities</h1>
              <p className="text-gray-600 mt-1">Find your next role in public affairs and communications</p>
            </div>
            <div className="text-sm text-gray-500">
              Powered by <span className="font-semibold text-blue-600">AlvaP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="input pl-10 w-full"
                      placeholder="Job title, company..."
                    />
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <select
                    value={filters.skill}
                    onChange={(e) => handleFilterChange('skill', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">All Skills</option>
                    <option value="communications">Communications</option>
                    <option value="campaigns">Campaigns</option>
                    <option value="policy">Policy</option>
                    <option value="publicAffairs">Public Affairs</option>
                  </select>
                </div>

                {/* Salary Band */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salary Band</label>
                  <select
                    value={filters.band}
                    onChange={(e) => handleFilterChange('band', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">All Bands</option>
                    {getBandOptions().map(band => (
                      <option key={band} value={band}>
                        £{band.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    className="input w-full"
                    placeholder="e.g., London, Remote"
                  />
                </div>

                {/* Employment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={filters.employmentType}
                    onChange={(e) => handleFilterChange('employmentType', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">All Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {pagination.total} job{pagination.total !== 1 ? 's' : ''} found
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your filters or check back later for new opportunities.
                </p>
                <button
                  onClick={clearFilters}
                  className="btn btn-primary"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.publicSlug}`}
                    className="block bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {job.title}
                          </h3>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                            {job.clientPublicName && (
                              <div className="flex items-center">
                                <Building2 className="h-4 w-4 mr-1" />
                                {job.clientPublicName}
                              </div>
                            )}
                            {job.location && (
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {job.location}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {formatDate(job.createdAt)}
                            </div>
                          </div>

                          {job.publicSummary && (
                            <p className="text-gray-700 mb-3 line-clamp-2">
                              {job.publicSummary}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center text-green-600 font-medium">
                                <DollarSign className="h-4 w-4 mr-1" />
                                {formatSalary(job.salaryMin, job.salaryMax)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {job.employmentType}
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-500">
                              {getSkillNames(job.requiredSkills)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-8">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="btn btn-outline btn-sm"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="btn btn-outline btn-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>© 2024 AlvaP. All rights reserved.</p>
            <p className="mt-1">
              Questions? Contact{' '}
              <a href="mailto:jobs@alvap.com" className="text-blue-600 hover:text-blue-800">
                jobs@alvap.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
