import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Mail, 
  Star, 
  X, 
  Edit, 
  Trash2, 
  Eye,
  DollarSign,
  Building2,
  Tag,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { api, Job, Candidate, Match } from '../lib/api';
import toast from 'react-hot-toast';

interface JobRecommendation {
  id: string;
  fullName: string;
  score: number;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  sent_at: string;
  status: 'sent' | 'failed';
}

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [emailLog, setEmailLog] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    if (jobId) {
      loadJobData();
    }
  }, [jobId]);

  const loadJobData = async () => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      const [jobData, matchesData, recommendationsData] = await Promise.all([
        api.getJob(jobId),
        api.getJobMatches(jobId),
        api.getJobRecommendations(jobId)
      ]);
      
      setJob(jobData);
      setMatches(matchesData.matches);
      setRecommendations(recommendationsData);
      
      // Load email log from backend
      try {
        const emailData = await api.getEmails(jobId, 5);
        setEmailLog(emailData.emails.map(email => ({
          id: email.id,
          to: email.to,
          subject: email.subject,
          sent_at: email.sent_at,
          status: email.status
        })));
      } catch (error) {
        console.error('Error loading email log:', error);
        setEmailLog([]);
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachCandidate = async (candidateId: string) => {
    if (!jobId) return;
    
    try {
      await api.addJobMatch(jobId, candidateId);
      toast.success('Candidate attached successfully');
      loadJobData();
      setShowAttachModal(false);
    } catch (error) {
      console.error('Error attaching candidate:', error);
      toast.error('Failed to attach candidate');
    }
  };

  const handleRemoveMatch = async (matchId: string) => {
    try {
      await api.deleteMatch(matchId);
      toast.success('Candidate removed from job');
      loadJobData();
    } catch (error) {
      console.error('Error removing match:', error);
      toast.error('Failed to remove candidate');
    }
  };

  const handleUpdateMatchStage = async (matchId: string, stage: string) => {
    try {
      await api.updateMatch(matchId, { stage: stage as any });
      toast.success('Stage updated');
      loadJobData();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const handleSendEmail = async () => {
    try {
      await api.sendEmail({
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        jobId: jobId,
        candidateIds: selectedCandidates
      });
      
      toast.success('Email sent successfully');
      setShowEmailModal(false);
      setEmailForm({ to: '', subject: '', body: '' });
      setSelectedCandidates([]);
      loadJobData(); // Reload to get updated email log
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    }
  };

  const insertCVLights = () => {
    const selectedMatches = matches.filter(m => selectedCandidates.includes(m.candidate_id));
    const cvLights = selectedMatches.map(match => {
      const candidate = match.candidate;
      return `**${candidate?.full_name}** - ${candidate?.current_title || 'No title'} at ${candidate?.current_employer || 'No employer'}\n` +
             `Match Score: ${match.score}%\n` +
             `Skills: Communications ${candidate?.skills?.communications || 0}/5, ` +
             `Campaigns ${candidate?.skills?.campaigns || 0}/5, ` +
             `Policy ${candidate?.skills?.policy || 0}/5, ` +
             `Public Affairs ${candidate?.skills?.publicAffairs || 0}/5\n\n`;
    }).join('');
    
    setEmailForm(prev => ({
      ...prev,
      body: prev.body + cvLights
    }));
  };

  const getStageColor = (stage: string) => {
    const colors = {
      'new': 'bg-blue-100 text-blue-800',
      'reviewed': 'bg-yellow-100 text-yellow-800',
      'contacted': 'bg-orange-100 text-orange-800',
      'interviewed': 'bg-purple-100 text-purple-800',
      'offered': 'bg-green-100 text-green-800',
      'placed': 'bg-emerald-100 text-emerald-800',
      'rejected': 'bg-red-100 text-red-800'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'new': return <Clock className="h-3 w-3" />;
      case 'reviewed': return <Eye className="h-3 w-3" />;
      case 'contacted': return <Mail className="h-3 w-3" />;
      case 'interviewed': return <Users className="h-3 w-3" />;
      case 'offered': return <CheckCircle className="h-3 w-3" />;
      case 'placed': return <Star className="h-3 w-3" />;
      case 'rejected': return <X className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Job not found</h3>
        <p className="text-gray-500 mb-4">The job you're looking for doesn't exist or has been deleted.</p>
        <button
          onClick={() => navigate('/jobs')}
          className="btn btn-primary"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/jobs')}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center space-x-4 mt-1">
              {job.client && (
                <div className="flex items-center text-sm text-gray-600">
                  <Building2 className="h-4 w-4 mr-1" />
                  {job.client.name}
                </div>
              )}
              {job.salary_min && job.salary_max && (
                <div className="flex items-center text-sm text-gray-600">
                  <DollarSign className="h-4 w-4 mr-1" />
                  £{job.salary_min.toLocaleString()} - £{job.salary_max.toLocaleString()}
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(job.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowEmailModal(true)}
            className="btn btn-outline"
            disabled={matches.length === 0}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Client
          </button>
          <button
            onClick={() => setShowAttachModal(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Attach Candidate
          </button>
        </div>
      </div>

      {/* Job Tags */}
      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.tags.map((tag, index) => (
            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attached Candidates */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Attached Candidates</h2>
              <span className="text-sm text-gray-500">{matches.length} candidates</span>
            </div>
            
            {matches.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">No candidates attached</h3>
                <p className="text-sm text-gray-500 mb-4">Attach candidates to this job to get started.</p>
                <button
                  onClick={() => setShowAttachModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Attach Candidate
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {match.candidate?.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{match.candidate?.full_name}</h4>
                          <p className="text-sm text-gray-500">
                            {match.candidate?.current_title} at {match.candidate?.current_employer}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{match.score}%</span>
                            <Star className="h-4 w-4 text-yellow-400" />
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <select
                              value={match.stage}
                              onChange={(e) => handleUpdateMatchStage(match.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full border-0 ${getStageColor(match.stage)}`}
                            >
                              <option value="new">New</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="contacted">Contacted</option>
                              <option value="interviewed">Interviewed</option>
                              <option value="offered">Offered</option>
                              <option value="placed">Placed</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setSelectedCandidates(prev => 
                          prev.includes(match.candidate_id) 
                            ? prev.filter(id => id !== match.candidate_id)
                            : [...prev, match.candidate_id]
                        )}
                        className={`p-2 rounded ${
                          selectedCandidates.includes(match.candidate_id)
                            ? 'bg-primary-100 text-primary-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveMatch(match.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Log */}
          {emailLog.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Emails</h2>
              <div className="space-y-2">
                {emailLog.map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                      <p className="text-xs text-gray-500">To: {email.to}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        email.status === 'sent' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {email.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(email.sent_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recommended Prospects */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended Prospects</h2>
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">No recommendations available</p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{rec.fullName}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm font-medium text-gray-900">{rec.score}%</span>
                        <Star className="h-3 w-3 text-yellow-400" />
                      </div>
                    </div>
                    <button
                      onClick={() => handleAttachCandidate(rec.id)}
                      className="btn btn-sm btn-outline"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attach Candidate Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attach Candidate</h3>
            <p className="text-sm text-gray-500 mb-4">
              TODO: Implement candidate search and selection
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAttachModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAttachModal(false)}
                className="btn btn-primary"
                disabled
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compose Email</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  className="input w-full"
                  placeholder="client@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="input w-full"
                  placeholder="Job opportunity - {job.title}"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Body</label>
                  <button
                    onClick={insertCVLights}
                    className="btn btn-sm btn-outline"
                    disabled={selectedCandidates.length === 0}
                  >
                    Insert CV Lights
                  </button>
                </div>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  className="input w-full"
                  placeholder="Write your email here..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowEmailModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                className="btn btn-primary"
                disabled={!emailForm.to || !emailForm.subject}
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
