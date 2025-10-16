import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, Candidate } from '../lib/api';
import { formatDate } from '../lib/utils';
import { ArrowLeft, Edit, Mail, MailCheck, MailX, Send, Calendar, User, Building, Phone, DollarSign, Tag, FileText, AlertCircle, CheckCircle, Share2 } from 'lucide-react';
import AIOneLinerGenerator from '../components/AIOneLinerGenerator';
import { NativeFeatures } from '../lib/nativeFeatures';
import toast from 'react-hot-toast';

export default function CandidateDetail() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    if (candidateId) {
      loadCandidate();
    }
  }, [candidateId]);

  const loadCandidate = async () => {
    try {
      setLoading(true);
      const candidates = await api.getCandidates({ limit: 1 });
      const foundCandidate = candidates.candidates.find(c => c.id === candidateId);
      
      if (foundCandidate) {
        setCandidate(foundCandidate);
      } else {
        toast.error('Candidate not found');
        navigate('/candidates');
      }
    } catch (error) {
      console.error('Failed to load candidate:', error);
      toast.error('Failed to load candidate details');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailToggle = async () => {
    if (!candidate) return;
    
    try {
      setUpdatingEmail(true);
      const updatedCandidate = await api.updateCandidateEmailPreferences(
        candidate.id, 
        !candidate.email_ok
      );
      setCandidate(updatedCandidate);
      toast.success(`Email updates ${updatedCandidate.email_ok ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update email preferences:', error);
      toast.error('Failed to update email preferences');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleResendWelcome = async () => {
    if (!candidate) return;
    
    try {
      setResendingEmail(true);
      await api.resendWelcomeEmail(candidate.id);
      toast.success('Welcome email sent successfully');
      
      // Reload candidate to get updated welcome_sent_at
      await loadCandidate();
    } catch (error) {
      console.error('Failed to resend welcome email:', error);
      toast.error('Failed to resend welcome email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGeneratePortalLink = async () => {
    if (!candidate) return;
    
    try {
      const response = await api.generatePortalLink(candidate.id);
      
      if (response.success) {
        // Copy to clipboard
        await navigator.clipboard.writeText(response.portalUrl);
        toast.success('Portal link copied to clipboard!');
        
        // Also show the URL in a more detailed toast
        toast.success(
          <div>
            <p className="font-medium">Portal link generated!</p>
            <p className="text-sm text-gray-600 mt-1">
              Link expires in {response.expiresIn}. Copied to clipboard.
            </p>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.error('Failed to generate portal link');
      }
    } catch (error) {
      console.error('Failed to generate portal link:', error);
      toast.error('Failed to generate portal link');
    }
  };

  const handleShareCandidate = async () => {
    if (!candidate) return;
    
    try {
      const success = await NativeFeatures.shareCandidate({
        name: candidate.full_name,
        title: candidate.current_title || 'Professional',
        email: candidate.email,
        phone: candidate.phone,
        oneLiner: `Experienced ${candidate.current_title || 'professional'} with expertise in ${Object.keys(candidate.skills).filter(skill => candidate.skills[skill as keyof typeof candidate.skills]).join(', ')}`
      });
      
      if (success) {
        toast.success('Candidate shared successfully!');
      } else {
        toast.error('Share not available on this device');
      }
    } catch (error) {
      console.error('Error sharing candidate:', error);
      toast.error('Failed to share candidate');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Candidate not found</h3>
        <p className="text-gray-500 mb-4">The candidate you're looking for doesn't exist.</p>
        <Link to="/candidates" className="btn btn-primary">
          Back to Candidates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/candidates')}
              className="btn btn-ghost btn-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {candidate.full_name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {candidate.current_title && candidate.current_employer 
                  ? `${candidate.current_title} at ${candidate.current_employer}`
                  : candidate.current_title || candidate.current_employer || 'No current role'
                }
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <Link
            to={`/candidates/${candidate.id}/edit`}
            className="btn btn-outline btn-md"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
          <button
            onClick={handleShareCandidate}
            className="btn btn-outline btn-md"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </button>
          <button
            onClick={handleGeneratePortalLink}
            className="btn btn-primary btn-md"
          >
            <User className="h-4 w-4 mr-2" />
            Generate Portal Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              {candidate.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-900">{candidate.email}</span>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-900">{candidate.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Professional Details */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Professional Details</h3>
            <div className="space-y-4">
              {candidate.salary_min && candidate.salary_max && (
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    £{candidate.salary_min.toLocaleString()} - £{candidate.salary_max.toLocaleString()}
                  </span>
                </div>
              )}
              {candidate.seniority && (
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-900 capitalize">{candidate.seniority}</span>
                </div>
              )}
              {candidate.tags.length > 0 && (
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <Tag className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Skills */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Skills</h3>
            <div className="space-y-3">
              {Object.entries(candidate.skills).map(([skill, rating]) => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {skill.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(rating / 5) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500 w-6">{rating}/5</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {candidate.notes && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.notes}</p>
            </div>
          )}

          {/* AI One-liner Generator */}
          <div className="card p-6">
            <AIOneLinerGenerator
              candidate={{
                full_name: candidate.full_name,
                current_title: candidate.current_title,
                current_employer: candidate.current_employer,
                skills: candidate.skills,
                salary_min: candidate.salary_min,
                salary_max: candidate.salary_max,
                experience: candidate.experience,
                tags: candidate.tags,
                notes: candidate.notes
              }}
              onOneLinerSelect={(oneLiner) => {
                // Could be used to update candidate notes or create a summary
                console.log('Selected one-liner:', oneLiner);
              }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Email Preferences */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Email Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {candidate.email_ok ? (
                    <MailCheck className="h-5 w-5 text-green-500" />
                  ) : (
                    <MailX className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email Updates</p>
                    <p className="text-xs text-gray-500">
                      {candidate.email_ok ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleEmailToggle}
                  disabled={updatingEmail}
                  className={`btn btn-sm ${candidate.email_ok ? 'btn-outline' : 'btn-primary'}`}
                >
                  {updatingEmail ? (
                    <div className="loading loading-spinner loading-xs"></div>
                  ) : candidate.email_ok ? (
                    'Disable'
                  ) : (
                    'Enable'
                  )}
                </button>
              </div>

              {candidate.welcome_sent_at && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3 mb-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">Welcome Email</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Sent on {formatDate(candidate.welcome_sent_at)}
                  </p>
                  
                  {/* Email content indicator */}
                  <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
                    {(() => {
                      const hasSkills = Object.values(candidate.skills).some(skill => skill > 0);
                      const hasSalary = candidate.salary_min || candidate.salary_max;
                      
                      if (hasSkills && hasSalary) {
                        return "Welcome email content: includes skills + salary (based on profile).";
                      } else if (hasSkills) {
                        return "Welcome email content: includes skills (salary omitted due to missing data).";
                      } else if (hasSalary) {
                        return "Welcome email content: includes salary (skills omitted due to missing data).";
                      } else {
                        return "Welcome email sent (skills/salary omitted due to missing data).";
                      }
                    })()}
                  </div>
                  
                  {candidate.email_ok && candidate.email && (
                    <button
                      onClick={handleResendWelcome}
                      disabled={resendingEmail}
                      className="btn btn-sm btn-outline w-full"
                    >
                      {resendingEmail ? (
                        <div className="loading loading-spinner loading-xs mr-2"></div>
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Resend Welcome Email
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-gray-900">Profile created</p>
                  <p className="text-xs text-gray-500">{formatDate(candidate.created_at)}</p>
                </div>
              </div>
              {candidate.welcome_sent_at && (
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-900">Welcome email sent</p>
                    <p className="text-xs text-gray-500">{formatDate(candidate.welcome_sent_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
