import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, PublicJob, JobInterestData } from '../lib/api';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  DollarSign, 
  Building2, 
  Briefcase,
  Mail,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicJobDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [interestForm, setInterestForm] = useState<JobInterestData>({
    name: '',
    email: '',
    message: ''
  });

  useEffect(() => {
    if (slug) {
      loadJob();
    }
  }, [slug]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const response = await api.getPublicJob(slug!);
      
      if (response.success) {
        setJob(response.data);
      } else {
        toast.error('Job not found');
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!job || !interestForm.name || !interestForm.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.submitJobInterest(job.publicSlug, interestForm);
      
      if (response.success) {
        setSubmitted(true);
        toast.success(response.message);
        setInterestForm({ name: '', email: '', message: '' });
      } else {
        toast.error('Failed to submit interest');
      }
    } catch (error) {
      console.error('Failed to submit interest:', error);
      toast.error('Failed to submit interest');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSalary = (min: number, max: number) => {
    return `£${min.toLocaleString()} - £${max.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
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
      .map(([key, _]) => skillNames[key as keyof typeof skillNames]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h1>
          <p className="text-gray-600 mb-6">This job is no longer available or has been removed.</p>
          <Link to="/jobs" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/jobs"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                  {job.clientPublicName && (
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-1" />
                      {job.clientPublicName}
                    </div>
                  )}
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Posted {formatDate(job.createdAt)}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Powered by <span className="font-semibold text-blue-600">AlvaP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
              
              {job.publicSummary ? (
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{job.publicSummary}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">No description available for this role.</p>
              )}
            </div>

            {/* Job Details */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Salary Range</h4>
                  <div className="flex items-center text-green-600">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatSalary(job.salaryMin, job.salaryMax)}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Employment Type</h4>
                  <div className="flex items-center text-gray-700">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {job.employmentType}
                  </div>
                </div>
                
                {job.location && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Location</h4>
                    <div className="flex items-center text-gray-700">
                      <MapPin className="h-4 w-4 mr-1" />
                      {job.location}
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {getSkillNames(job.requiredSkills).map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interest Form Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              {submitted ? (
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Interest Submitted!</h3>
                  <p className="text-gray-600 mb-4">
                    Thank you for your interest. We'll be in touch soon.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="btn btn-outline w-full"
                  >
                    Submit Another
                  </button>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Express Interest</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Interested in this role? Submit your details and we'll get back to you.
                  </p>
                  
                  <form onSubmit={handleSubmitInterest} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={interestForm.name}
                        onChange={(e) => setInterestForm(prev => ({ ...prev, name: e.target.value }))}
                        className="input w-full"
                        placeholder="Your full name"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={interestForm.email}
                        onChange={(e) => setInterestForm(prev => ({ ...prev, email: e.target.value }))}
                        className="input w-full"
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message (Optional)
                      </label>
                      <textarea
                        value={interestForm.message}
                        onChange={(e) => setInterestForm(prev => ({ ...prev, message: e.target.value }))}
                        rows={3}
                        className="input w-full"
                        placeholder="Tell us why you're interested in this role..."
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={submitting || !interestForm.name || !interestForm.email}
                      className="btn btn-primary w-full"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Submit Interest
                        </>
                      )}
                    </button>
                  </form>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      By submitting, you agree to be contacted about this opportunity.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
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
