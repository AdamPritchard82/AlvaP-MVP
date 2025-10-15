import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';

interface Skill {
  name: string;
  weight: number;
  scale_max: number;
}

interface RoleBasedSkillsProps {
  selectedRole: string;
  skills: Record<string, number>; // skill name -> rating (0-5)
  onSkillsChange: (skills: Record<string, number>) => void;
  onCustomSkillsChange: (customSkills: string[]) => void;
  customSkills: string[];
}

export function RoleBasedSkills({ 
  selectedRole, 
  skills, 
  onSkillsChange, 
  onCustomSkillsChange,
  customSkills 
}: RoleBasedSkillsProps) {
  const [taxonomySkills, setTaxonomySkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCustomSkill, setNewCustomSkill] = useState('');

  useEffect(() => {
    if (selectedRole) {
      loadSkillsForRole(selectedRole);
    } else {
      setTaxonomySkills([]);
    }
  }, [selectedRole]);

  const loadSkillsForRole = async (roleName: string) => {
    try {
      setLoading(true);
      const response = await api.getActiveTaxonomy();
      if (response.success && response.skillsByRole[roleName]) {
        setTaxonomySkills(response.skillsByRole[roleName]);
      } else {
        setTaxonomySkills([]);
      }
    } catch (error) {
      console.error('Error loading skills for role:', error);
      setTaxonomySkills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillRatingChange = (skillName: string, rating: number) => {
    onSkillsChange({
      ...skills,
      [skillName]: rating
    });
  };

  const addCustomSkill = () => {
    if (newCustomSkill.trim() && !customSkills.includes(newCustomSkill.trim())) {
      onCustomSkillsChange([...customSkills, newCustomSkill.trim()]);
      setNewCustomSkill('');
    }
  };

  const removeCustomSkill = (skillToRemove: string) => {
    onCustomSkillsChange(customSkills.filter(skill => skill !== skillToRemove));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedRole) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Please select a role to see available skills</p>
      </div>
    );
  }

  if (taxonomySkills.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">No predefined skills for this role. Add custom skills below.</p>
        
        {/* Custom Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Skills
          </label>
          <div className="space-y-2">
            {customSkills.map((skill, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-900">{skill}</span>
                <button
                  onClick={() => removeCustomSkill(skill)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex items-center space-x-2 mt-2">
            <input
              type="text"
              value={newCustomSkill}
              onChange={(e) => setNewCustomSkill(e.target.value)}
              placeholder="Enter custom skill"
              className="flex-1 border border-gray-300 rounded px-3 py-1 text-sm"
            />
            <button
              onClick={addCustomSkill}
              disabled={!newCustomSkill.trim()}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Taxonomy Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rate Skills (1-5 scale)
        </label>
        <div className="space-y-3">
          {taxonomySkills.map((skill) => (
            <div key={skill.name} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {skill.name}
              </label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleSkillRatingChange(skill.name, rating)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                      (skills[skill.name] || 0) >= rating
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-blue-300'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSkillRatingChange(skill.name, 0)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                    (skills[skill.name] || 0) === 0
                      ? 'bg-gray-500 border-gray-500 text-white'
                      : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  0
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Custom Skills
        </label>
        <div className="space-y-2">
          {customSkills.map((skill, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-900">{skill}</span>
              <button
                type="button"
                onClick={() => removeCustomSkill(skill)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-2 mt-2">
          <input
            type="text"
            value={newCustomSkill}
            onChange={(e) => setNewCustomSkill(e.target.value)}
            placeholder="Enter custom skill"
            className="flex-1 border border-gray-300 rounded px-3 py-1 text-sm"
          />
          <button
            type="button"
            onClick={addCustomSkill}
            disabled={!newCustomSkill.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
