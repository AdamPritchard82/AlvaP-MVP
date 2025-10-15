import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface TrialStatus {
  trialing: boolean;
  daysRemaining: number;
  trialEndsAt?: string;
  trialStartedAt?: string;
}

interface TrialBannerProps {
  onDismiss?: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ onDismiss }) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadTrialStatus();
  }, []);

  const loadTrialStatus = async () => {
    try {
      const response = await api.get('/billing/trial/status');
      setTrialStatus(response.data.data);
    } catch (error) {
      console.error('Error loading trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (loading || dismissed || !trialStatus) {
    return null;
  }

  // Don't show banner if not trialing
  if (!trialStatus.trialing) {
    return null;
  }

  const daysRemaining = trialStatus.daysRemaining;
  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining <= 0;

  // Show banner for all trial days (not just last 7)
  // if (daysRemaining > 7) {
  //   return null;
  // }

  const getBannerContent = () => {
    if (isExpired) {
      return {
        title: 'Trial Ended',
        message: 'Your free trial has ended. Add payment details to continue using AlvaP.',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-400',
        ctaText: 'Add Payment Method',
        ctaHref: '/settings/billing'
      };
    } else if (isUrgent) {
      return {
        title: 'Trial Ending Soon',
        message: `Your free trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Add payment details to avoid interruption.`,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-400',
        ctaText: 'Add Payment Method',
        ctaHref: '/settings/billing'
      };
    } else if (daysRemaining >= 7) {
      return {
        title: 'Welcome to AlvaP!',
        message: `You're on a ${daysRemaining}-day free trial. Explore the platform and configure your industry focus.`,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        iconColor: 'text-green-400',
        ctaText: 'View Billing',
        ctaHref: '/settings/billing'
      };
    } else {
      return {
        title: 'Free Trial Active',
        message: `${daysRemaining} days remaining in your free trial.`,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-400',
        ctaText: 'View Billing',
        ctaHref: '/settings/billing'
      };
    }
  };

  const banner = getBannerContent();

  return (
    <div className={`${banner.bgColor} ${banner.borderColor} border-b`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {isExpired ? (
                <svg className={`h-5 w-5 ${banner.iconColor}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className={`h-5 w-5 ${banner.iconColor}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${banner.textColor}`}>
                {banner.title}
              </h3>
              <div className={`mt-1 text-sm ${banner.textColor}`}>
                <p>{banner.message}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <a
              href={banner.ctaHref}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                isExpired 
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : isUrgent
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {banner.ctaText}
            </a>
            
            <button
              onClick={handleDismiss}
              className={`text-sm ${banner.textColor} hover:opacity-75`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
