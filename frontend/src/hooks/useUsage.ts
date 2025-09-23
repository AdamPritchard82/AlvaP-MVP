import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface UsageLimits {
  candidates: number;
  jobs: number;
  cv_parsing: boolean;
  email_templates: boolean;
  api_access: boolean;
  custom_integrations?: boolean;
  analytics?: boolean;
}

interface UsageStats {
  candidates: number;
  jobs: number;
  matches: number;
}

interface UsageData {
  limits: UsageLimits;
  current: UsageStats;
  plan: {
    id: string;
    name: string;
  };
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const [subscription, candidates, jobs, matches] = await Promise.all([
        api.getSubscription(),
        api.getCandidates({ limit: 1000 }),
        api.getJobs({ limit: 1000 }),
        api.getMatches({ limit: 1000 })
      ]);

      setUsage({
        limits: subscription.plan.limits,
        current: {
          candidates: candidates.candidates?.length || 0,
          jobs: jobs.jobs?.length || 0,
          matches: matches.matches?.length || 0
        },
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name
        }
      });
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const isLimitReached = (resource: keyof UsageStats): boolean => {
    if (!usage) return false;
    const limit = usage.limits[resource];
    const current = usage.current[resource];
    
    // -1 means unlimited
    if (limit === -1) return false;
    return current >= limit;
  };

  const getUsagePercentage = (resource: keyof UsageStats): number => {
    if (!usage) return 0;
    const limit = usage.limits[resource];
    const current = usage.current[resource];
    
    if (limit === -1) return 0; // unlimited
    if (limit === 0) return 100; // no limit but no usage
    return Math.min((current / limit) * 100, 100);
  };

  const canUseFeature = (feature: keyof UsageLimits): boolean => {
    if (!usage) return false;
    return Boolean(usage.limits[feature]);
  };

  return {
    usage,
    loading,
    isLimitReached,
    getUsagePercentage,
    canUseFeature,
    refresh: loadUsage
  };
}



