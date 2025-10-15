import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CreditCard, Users, Clock, Star } from 'lucide-react';

interface PricingGateProps {
  onContinue: () => void;
}

export default function PricingGate({ onContinue }: PricingGateProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const plans = {
    monthly: {
      name: 'Monthly Plan',
      price: '£39',
      period: 'per user/month',
      description: 'Perfect for growing teams',
      features: [
        'Unlimited candidates',
        'Advanced search & filtering',
        'CV parsing & analysis',
        'Email campaigns',
        'Analytics dashboard',
        'Priority support'
      ]
    },
    annual: {
      name: 'Annual Plan',
      price: '£32',
      period: 'per user/month',
      savings: 'Save 18%',
      description: 'Best value for established teams',
      features: [
        'Everything in Monthly',
        '18% savings',
        'Priority feature requests',
        'Dedicated account manager',
        'Custom integrations',
        'Advanced reporting'
      ]
    }
  };

  const currentPlan = plans[selectedPlan];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to AlvaP</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose your plan to get started with candidate management
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* Plan Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-200 rounded-lg p-1 flex">
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPlan === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPlan === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Selected Plan */}
          <div className="relative">
            <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{currentPlan.name}</h3>
                {currentPlan.savings && (
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {currentPlan.savings}
                  </span>
                )}
              </div>
              
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">{currentPlan.price}</span>
                <span className="text-gray-500 ml-2">{currentPlan.period}</span>
              </div>
              
              <p className="text-gray-600 mb-6">{currentPlan.description}</p>
              
              <ul className="space-y-3 mb-6">
                {currentPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={onContinue}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </button>
            </div>
          </div>

          {/* Trial Info */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Clock className="h-6 w-6 text-orange-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">10-Day Free Trial</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Try AlvaP risk-free for 10 days. No credit card required.
            </p>
            
            <ul className="space-y-2 mb-6">
              <li className="flex items-center text-sm text-gray-700">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                Full access to all features
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                No commitment required
              </li>
              <li className="flex items-center text-sm text-gray-700">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                Cancel anytime
              </li>
            </ul>
            
            <div className="bg-blue-50 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>What happens after the trial?</strong><br />
                You can continue with the plan you selected, or choose a different option.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
