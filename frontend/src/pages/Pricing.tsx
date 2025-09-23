import { useState, useEffect } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: Record<string, any>;
  stripe_price_id?: string;
  stripe_yearly_price_id?: string;
}

interface Subscription {
  plan: Plan;
  subscription: {
    id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
  } | null;
}

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, subscriptionData] = await Promise.all([
        api.getPlans(),
        api.getSubscription()
      ]);
      setPlans(plansData);
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error loading pricing data:', error);
      toast.error('Failed to load pricing information');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      toast.info('You are already on the free plan');
      return;
    }

    try {
      setCheckoutLoading(planId);
      const { checkoutUrl } = await api.createCheckoutSession(planId, billingCycle);
      
      // For MVP, we'll simulate a successful checkout
      // In production, this would redirect to Stripe
      toast.success('Checkout session created! (Demo mode)');
      
      // Simulate successful subscription
      setTimeout(() => {
        loadData();
        toast.success('Subscription activated!');
      }, 2000);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (priceInPence: number) => {
    return `£${(priceInPence / 100).toFixed(2)}`;
  };

  const getCurrentPlan = () => {
    return subscription?.plan || plans.find(p => p.id === 'free');
  };

  const isCurrentPlan = (planId: string) => {
    return getCurrentPlan()?.id === planId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Select the perfect plan for your recruitment needs
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Save 20%
            </span>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
          const isCurrent = isCurrentPlan(plan.id);
          const isPopular = plan.id === 'professional';
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 ${
                isPopular
                  ? 'border-primary-500 bg-primary-50'
                  : isCurrent
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary-500 px-4 py-1 text-sm font-medium text-white">
                    Most Popular
                  </span>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-green-500 px-4 py-1 text-sm font-medium text-white">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {price === 0 ? 'Free' : formatPrice(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-gray-600">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent || checkoutLoading === plan.id}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    isCurrent
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : isPopular
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Features included:</h4>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Subscription Info */}
      {subscription?.subscription && (
        <div className="mt-12 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Plan</dt>
              <dd className="text-lg font-semibold text-gray-900">{subscription.plan.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="text-lg font-semibold text-green-600 capitalize">
                {subscription.subscription.status}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Next Billing</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {new Date(subscription.subscription.current_period_end).toLocaleDateString()}
              </dd>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Can I change my plan at any time?
            </h3>
            <p className="text-gray-600">
              Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated and reflected in your next billing cycle.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              What happens to my data if I cancel?
            </h3>
            <p className="text-gray-600">
              Your data is safe. You can export all your data before canceling, and we'll keep it for 30 days in case you want to reactivate.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Do you offer refunds?
            </h3>
            <p className="text-gray-600">
              We offer a 30-day money-back guarantee for all paid plans. Contact support if you're not satisfied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



