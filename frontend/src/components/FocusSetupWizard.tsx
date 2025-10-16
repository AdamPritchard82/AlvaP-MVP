import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import { getAllIndustries, getRecommendedRoles, INDUSTRY_ROLE_PRESETS } from '../data/industryRolePresets';
import { api } from '../lib/api';

interface FocusSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function FocusSetupWizard({ isOpen, onClose, onComplete }: FocusSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allIndustries = getAllIndustries();
  const recommendedRoles = getRecommendedRoles(selectedIndustries);

  // Reset state when wizard opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedIndustries([]);
      setSelectedRoles([]);
      setCustomRole('');
      setError(null);
    }
  }, [isOpen]);

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries(prev => 
      prev.includes(industry) 
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    );
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const addCustomRole = () => {
    if (customRole.trim() && !selectedRoles.includes(customRole.trim())) {
      setSelectedRoles(prev => [...prev, customRole.trim()]);
      setCustomRole('');
    }
  };

  const removeRole = (role: string) => {
    setSelectedRoles(prev => prev.filter(r => r !== role));
  };

  const handleNext = () => {
    if (step === 1 && selectedIndustries.length === 0) {
      setError('Please select at least one industry');
      return;
    }
    if (step === 2 && selectedRoles.length === 0) {
      setError('Please select at least one role');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleComplete = async () => {
    if (selectedIndustries.length === 0 || selectedRoles.length === 0) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save focus configuration
      await api.createFocusConfiguration({
        industries: selectedIndustries,
        roles: selectedRoles
      });
      
      onComplete();
    } catch (err) {
      setError('Failed to save configuration. Please try again.');
      console.error('Error saving focus configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Configure Your Focus</h2>
            <p className="text-gray-600 mt-1">Set up your industries and roles to get started</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Industries</span>
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Roles</span>
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Review</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Industries */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Your Industries</h3>
              <p className="text-gray-600 mb-6">Choose the industries you work in or are interested in:</p>
              
              <div className="grid grid-cols-2 gap-3">
                {allIndustries.map(industry => (
                  <button
                    key={industry}
                    onClick={() => handleIndustryToggle(industry)}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      selectedIndustries.includes(industry)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{industry}</span>
                      {selectedIndustries.includes(industry) && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Roles */}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Your Roles</h3>
              <p className="text-gray-600 mb-6">Choose the roles that match your work or interests:</p>
              
              {/* Recommended roles */}
              {recommendedRoles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Recommended Roles</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {recommendedRoles.map(role => (
                      <button
                        key={role}
                        onClick={() => handleRoleToggle(role)}
                        className={`p-2 text-left border rounded-md transition-colors text-sm ${
                          selectedRoles.includes(role)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{role}</span>
                          {selectedRoles.includes(role) && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add custom role */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add Custom Role</h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Enter a custom role..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomRole()}
                  />
                  <button
                    onClick={addCustomRole}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Selected roles */}
              {selectedRoles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Roles ({selectedRoles.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map(role => (
                      <span
                        key={role}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {role}
                        <button
                          onClick={() => removeRole(role)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Configuration</h3>
              <p className="text-gray-600 mb-6">Please review your selections before saving:</p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Industries ({selectedIndustries.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIndustries.map(industry => (
                      <span
                        key={industry}
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                      >
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Roles ({selectedRoles.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map(role => (
                      <span
                        key={role}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={step === 1 ? onClose : handleBack}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <div className="flex space-x-3">
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
