import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface BillingPlan {
  id: string;
  code: string;
  name: string;
  interval: 'monthly' | 'annual';
  amount_pence: number;
  is_active: boolean;
}

interface BillingSummary {
  orgId: string;
  plan: BillingPlan;
  seats: number;
  status: string;
  trial: {
    trialing: boolean;
    daysRemaining: number;
    trialEndsAt?: string;
  };
  promo?: {
    code: string;
    expiresAt?: string;
  };
  amount: {
    subtotal: number;
    discount: number;
    total: number;
  };
}

interface PromoCode {
  code: string;
  description: string;
  percent_off: number;
  expires_at?: string;
  max_redemptions?: number;
  redeemed_count: number;
}

const BillingSettings: React.FC = () => {
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [summaryRes, plansRes, promoCodesRes] = await Promise.all([
        api.get('/billing/summary'),
        api.get('/billing/plans'),
        api.get('/billing/promo-codes')
      ]);

      setBillingSummary(summaryRes.data.data);
      setPlans(plansRes.data.data);
      setPromoCodes(promoCodesRes.data.data);
    } catch (err) {
      console.error('Error loading billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    try {
      setError(null);
      const response = await api.post('/billing/promo/apply', { code: promoCode });
      setSuccess(response.data.message);
      setPromoCode('');
      await loadBillingData(); // Refresh data
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply promo code');
    }
  };

  const handleSwitchPlan = async (planCode: string) => {
    try {
      setError(null);
      await api.post('/billing/plan/switch', { planCode });
      setSuccess('Plan switched successfully');
      await loadBillingData(); // Refresh data
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to switch plan');
    }
  };

  const formatCurrency = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  const formatMonthlyPrice = (pence: number, interval: string) => {
    if (interval === 'annual') {
      return `£${(pence / 100 / 12).toFixed(2)}/month`;
    }
    return `£${(pence / 100).toFixed(2)}/month`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (!billingSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load billing information</p>
          <button 
            onClick={loadBillingData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your AlvaP Seat subscription and billing preferences
          </p>
        </div>

        {/* Trial Status Banner */}
        {billingSummary.trial.trialing && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Free Trial Active
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    {billingSummary.trial.daysRemaining > 0 
                      ? `${billingSummary.trial.daysRemaining} days remaining in your free trial`
                      : 'Your trial has ended'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Plan */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Plan</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium">{billingSummary.plan.name}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Price:</span>
                <span className="font-medium">
                  {formatMonthlyPrice(billingSummary.plan.amount_pence, billingSummary.plan.interval)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Seats:</span>
                <span className="font-medium">{billingSummary.seats}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  billingSummary.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                  billingSummary.status === 'active' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {billingSummary.status}
                </span>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Plans</h2>
            
            <div className="space-y-4">
              {plans.map((plan) => (
                <div 
                  key={plan.code}
                  className={`border rounded-lg p-4 ${
                    plan.code === billingSummary.plan.code 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-600">
                        {formatMonthlyPrice(plan.amount_pence, plan.interval)}
                        {plan.interval === 'annual' && (
                          <span className="text-green-600 ml-1">(Save 18%)</span>
                        )}
                      </p>
                    </div>
                    
                    {plan.code !== billingSummary.plan.code && (
                      <button
                        onClick={() => handleSwitchPlan(plan.code)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Promo Code Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Promo Code</h2>
          
          <div className="flex space-x-4">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleApplyPromo}
              disabled={!promoCode.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
          
          {billingSummary.promo && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                Active promo: <strong>{billingSummary.promo.code}</strong>
                {billingSummary.promo.expiresAt && (
                  <span className="ml-2 text-gray-600">
                    (expires {new Date(billingSummary.promo.expiresAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Billing Summary */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing Summary</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal ({billingSummary.seats} seats):</span>
              <span>{formatCurrency(billingSummary.amount.subtotal)}</span>
            </div>
            
            {billingSummary.amount.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(billingSummary.amount.discount)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(billingSummary.amount.total)}</span>
            </div>
          </div>
        </div>

        {/* Provider Status */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.726-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Payment Provider Status
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Payment provider not connected yet — charging will start when connected.</p>
                <p className="mt-1">For now, you can use promo codes and manage your plan settings.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSettings;
