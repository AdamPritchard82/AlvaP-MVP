import { useState, useEffect } from 'react';
import { Check, ChevronRight, Plus, X, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface IndustryPreset {
  name: string;
  roles: string[];
  skillsByRole: Record<string, Array<{ name: string; weight: number }>>;
}

interface Skill {
  name: string;
  weight: number;
  scale_max?: number;
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<IndustryPreset[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [skillsByRole, setSkillsByRole] = useState<Record<string, Skill[]>>({});
  const [taxonomyName, setTaxonomyName] = useState('');

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await api.getTaxonomyPresets();
      if (response.success) {
        setPresets(response.presets);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      toast.error('Failed to load industry presets');
    }
  };

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries(prev => {
      if (prev.includes(industry)) {
        return prev.filter(i => i !== industry);
      } else {
        return [...prev, industry];
      }
    });
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        // Remove skills for this role
        setSkillsByRole(prevSkills => {
          const newSkills = { ...prevSkills };
          delete newSkills[role];
          return newSkills;
        });
        return prev.filter(r => r !== role);
      } else {
        // Add skills for this role from presets
        const roleSkills = getSkillsForRole(role);
        setSkillsByRole(prev => ({
          ...prev,
          [role]: roleSkills
        }));
        return [...prev, role];
      }
    });
  };

  const getSkillsForRole = (role: string): Skill[] => {
    for (const preset of presets) {
      if (preset.skillsByRole[role]) {
        return preset.skillsByRole[role].map(skill => ({
          name: skill.name,
          weight: skill.weight,
          scale_max: 5
        }));
      }
    }
    return [];
  };

  const addCustomRole = () => {
    const roleName = prompt('Enter role name:');
    if (roleName && !selectedRoles.includes(roleName) && !customRoles.includes(roleName)) {
      setCustomRoles(prev => [...prev, roleName]);
      setSelectedRoles(prev => [...prev, roleName]);
      setSkillsByRole(prev => ({
        ...prev,
        [roleName]: []
      }));
    }
  };

  const removeCustomRole = (role: string) => {
    setCustomRoles(prev => prev.filter(r => r !== role));
    setSelectedRoles(prev => prev.filter(r => r !== role));
    setSkillsByRole(prev => {
      const newSkills = { ...prev };
      delete newSkills[role];
      return newSkills;
    });
  };

  const addSkillToRole = (role: string) => {
    const skillName = prompt('Enter skill name:');
    if (skillName) {
      setSkillsByRole(prev => ({
        ...prev,
        [role]: [...(prev[role] || []), { name: skillName, weight: 1, scale_max: 5 }]
      }));
    }
  };

  const removeSkillFromRole = (role: string, skillIndex: number) => {
    setSkillsByRole(prev => ({
      ...prev,
      [role]: prev[role].filter((_, index) => index !== skillIndex)
    }));
  };

  const updateSkillWeight = (role: string, skillIndex: number, weight: number) => {
    setSkillsByRole(prev => ({
      ...prev,
      [role]: prev[role].map((skill, index) => 
        index === skillIndex ? { ...skill, weight } : skill
      )
    }));
  };

  const canProceedToStep2 = selectedIndustries.length > 0;
  const canProceedToStep3 = selectedRoles.length > 0;
  const canComplete = selectedRoles.length > 0 && taxonomyName.trim().length > 0;

  const handleNext = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedToStep3) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!canComplete) return;

    try {
      setLoading(true);
      
      const response = await api.createTaxonomy({
        name: taxonomyName,
        industries: selectedIndustries,
        roles: selectedRoles,
        skillsByRole
      });

      if (response.success) {
        toast.success('Taxonomy created successfully!');
        onComplete();
      } else {
        toast.error('Failed to create taxonomy');
      }
    } catch (error) {
      console.error('Error creating taxonomy:', error);
      toast.error('Failed to create taxonomy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Setup Your Organization</h1>
          <p className="text-gray-600 mt-1">Configure your industry focus and role structure</p>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step === 1 ? 'Industries' : step === 2 ? 'Roles' : 'Skills'}
                </span>
                {step < 3 && (
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {/* Step 1: Industries */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Industries</h2>
              <p className="text-gray-600 mb-6">Choose the industries your organization focuses on. You can select multiple.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presets.map((preset) => (
                  <label
                    key={preset.name}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedIndustries.includes(preset.name)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIndustries.includes(preset.name)}
                        onChange={() => handleIndustryToggle(preset.name)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">{preset.name}</div>
                        <div className="text-sm text-gray-500">
                          {preset.roles.length} roles available
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Roles */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Roles</h2>
              <p className="text-gray-600 mb-6">Choose the roles you want to track. You can add custom roles as needed.</p>
              
              <div className="space-y-4">
                {/* Preset Roles */}
                {presets
                  .filter(preset => selectedIndustries.includes(preset.name))
                  .map(preset => (
                    <div key={preset.name}>
                      <h3 className="font-medium text-gray-700 mb-2">{preset.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {preset.roles.map(role => (
                          <label
                            key={role}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                              selectedRoles.includes(role)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedRoles.includes(role)}
                                onChange={() => handleRoleToggle(role)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm font-medium text-gray-900">{role}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                
                {/* Custom Roles */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-700">Custom Roles</h3>
                    <button
                      onClick={addCustomRole}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Custom Role
                    </button>
                  </div>
                  <div className="space-y-2">
                    {customRoles.map(role => (
                      <div key={role} className="flex items-center justify-between border rounded-lg p-3 bg-gray-50">
                        <span className="text-sm font-medium text-gray-900">{role}</span>
                        <button
                          onClick={() => removeCustomRole(role)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Configure Skills</h2>
              <p className="text-gray-600 mb-6">Review and customize the skills for each role. You can add, remove, or adjust skill weights.</p>
              
              <div className="space-y-6">
                {selectedRoles.map(role => (
                  <div key={role} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">{role}</h3>
                      <button
                        onClick={() => addSkillToRole(role)}
                        className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Skill
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {skillsByRole[role]?.map((skill, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{skill.name}</span>
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-500">Weight:</label>
                            <select
                              value={skill.weight}
                              onChange={(e) => updateSkillWeight(role, index, parseInt(e.target.value))}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              {[1, 2, 3, 4, 5].map(w => (
                                <option key={w} value={w}>{w}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeSkillFromRole(role, index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Taxonomy Name */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taxonomy Name
                  </label>
                  <input
                    type="text"
                    value={taxonomyName}
                    onChange={(e) => setTaxonomyName(e.target.value)}
                    placeholder="Enter a name for this taxonomy (e.g., 'Our Organization Structure')"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          
          <div className="flex items-center space-x-3">
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canProceedToStep2 && currentStep === 1 || !canProceedToStep3 && currentStep === 2}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!canComplete || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
