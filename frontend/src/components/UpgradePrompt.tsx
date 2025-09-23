import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Crown, Zap, CheckCircle } from 'lucide-react';

interface UpgradePromptProps {
  title: string;
  description: string;
  feature: string;
  currentPlan: string;
  onDismiss?: () => void;
  className?: string;
}

export default function UpgradePrompt({ 
  title, 
  description, 
  feature, 
  currentPlan, 
  onDismiss,
  className = ''
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className={`bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100">
            <Crown className="h-6 w-6 text-primary-600" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </h3>
          <p className="text-gray-600 mb-4">
            {description}
          </p>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/pricing"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Now
            </Link>
            
            <span className="text-sm text-gray-500">
              Current plan: <span className="font-medium">{currentPlan}</span>
            </span>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-4 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

interface UsageLimitPromptProps {
  resource: 'candidates' | 'jobs' | 'matches';
  current: number;
  limit: number;
  onDismiss?: () => void;
  className?: string;
}

export function UsageLimitPrompt({ 
  resource, 
  current, 
  limit, 
  onDismiss,
  className = ''
}: UsageLimitPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  const resourceNames = {
    candidates: 'candidates',
    jobs: 'jobs',
    matches: 'matches'
  };

  const isAtLimit = current >= limit;
  const percentage = Math.min((current / limit) * 100, 100);

  return (
    <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
            {isAtLimit ? (
              <X className="h-6 w-6 text-amber-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-amber-600" />
            )}
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isAtLimit ? 'Limit Reached' : 'Approaching Limit'}
          </h3>
          <p className="text-gray-600 mb-4">
            {isAtLimit 
              ? `You've reached your limit of ${limit} ${resourceNames[resource]}. Upgrade to add more.`
              : `You're using ${current} of ${limit} ${resourceNames[resource]} (${percentage.toFixed(0)}%). Consider upgrading soon.`
            }
          </p>
          
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Usage</span>
              <span>{current} / {limit === -1 ? '∞' : limit}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  percentage >= 90 ? 'bg-red-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/pricing"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Link>
            
            <button
              onClick={handleDismiss}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-4 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}



