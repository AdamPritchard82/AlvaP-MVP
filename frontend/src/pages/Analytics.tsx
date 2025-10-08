import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface SkillsBandsData {
  skillCounts: Record<string, number>;
  bandsData: Record<string, Array<{ band: string; count: number }>>;
  generatedAt: string;
}

interface PipelineData {
  stages: Record<string, number>;
  conversionRate: number;
  totalCandidates: number;
  totalJobs: number;
}

interface EmailOutcomesData {
  sent: number;
  opened: number;
  bounced: number;
  unsubscribed: number;
  last30Days: boolean;
}

interface ActivityItem {
  type: string;
  name: string;
  timestamp: string;
  description: string;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [skillsBands, setSkillsBands] = useState<SkillsBandsData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [emailOutcomes, setEmailOutcomes] = useState<EmailOutcomesData | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [skillsRes, pipelineRes, emailRes, activityRes] = await Promise.all([
        api.getSkillsBandsAnalytics(),
        api.getPipelineAnalytics(),
        api.getEmailOutcomesAnalytics(),
        api.getRecentActivityAnalytics(10)
      ]);

      setSkillsBands(skillsRes);
      setPipeline(pipelineRes.pipeline);
      setEmailOutcomes(emailRes.emailOutcomes);
      setRecentActivity(activityRes.activities);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadAnalytics}
            className="mt-4 btn btn-sm btn-outline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <button 
          onClick={loadAnalytics}
          className="btn btn-sm btn-outline"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Candidates by Skill & Band */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Candidates by Skill</h3>
          {skillsBands ? (
            <div className="space-y-3">
              {Object.entries(skillsBands.skillCounts).map(([skill, count]) => (
                <div key={skill} className="flex justify-between items-center">
                  <button
                    onClick={() => navigate(`/candidates?skill=${encodeURIComponent(skill)}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {skill}
                  </button>
                  <span className="font-bold text-lg">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No data available</div>
          )}
        </div>

        {/* Pipeline Snapshot */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Pipeline Snapshot</h3>
          {pipeline ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Total Candidates</span>
                <span className="font-bold">{formatNumber(pipeline.totalCandidates)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Jobs</span>
                <span className="font-bold">{formatNumber(pipeline.totalJobs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Conversion Rate</span>
                <span className="font-bold">{pipeline.conversionRate.toFixed(1)}%</span>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(pipeline.stages).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between text-sm">
                    <span>{stage}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No pipeline data</div>
          )}
        </div>

        {/* Email Outcomes */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Email Outcomes (30d)</h3>
          {emailOutcomes ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Sent</span>
                <span className="font-bold text-blue-600">{formatNumber(emailOutcomes.sent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Opened</span>
                <span className="font-bold text-green-600">{formatNumber(emailOutcomes.opened)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Bounced</span>
                <span className="font-bold text-red-600">{formatNumber(emailOutcomes.bounced)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Unsubscribed</span>
                <span className="font-bold text-orange-600">{formatNumber(emailOutcomes.unsubscribed)}</span>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-gray-500">
                  Open Rate: {emailOutcomes.sent > 0 ? ((emailOutcomes.opened / emailOutcomes.sent) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No email data</div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div key={index} className="text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{activity.name}</div>
                      <div className="text-gray-600 text-xs">{activity.description}</div>
                    </div>
                    <div className="text-xs text-gray-500 ml-2">
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No recent activity</div>
          )}
        </div>
      </div>

      {/* Skills & Bands Detail */}
      {skillsBands && (
        <div className="mt-8 bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Skills & Salary Bands</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(skillsBands.bandsData).map(([skill, bands]) => (
              <div key={skill} className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">{skill}</h4>
                <div className="space-y-2">
                  {bands.slice(0, 6).map((band, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <button
                        onClick={() => navigate(`/candidates?skill=${encodeURIComponent(skill)}&band=${encodeURIComponent(band.band)}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {band.band}
                      </button>
                      <span className="font-medium">{band.count}</span>
                    </div>
                  ))}
                  {bands.length > 6 && (
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      +{bands.length - 6} more bands
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
