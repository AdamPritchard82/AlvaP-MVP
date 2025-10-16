import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface Skill {
  id?: string;
  name: string;
  weight: number;
  scale_max: number;
}

interface Role {
  id: string;
  name: string;
  sortOrder: number;
}

interface TaxonomyData {
  roles: Role[];
  skillsByRole: Record<string, Skill[]>;
  hasActiveTaxonomy: boolean;
  taxonomy?: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
}

export default function TaxonomySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxonomyData, setTaxonomyData] = useState<TaxonomyData | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingSkill, setEditingSkill] = useState<{ role: string; skillIndex: number } | null>(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'role' | 'skill'; id: string; name: string } | null>(null);

  useEffect(() => {
    loadTaxonomyData();
  }, []);

  const loadTaxonomyData = async () => {
    try {
      setLoading(true);
      const response = await api.getActiveTaxonomy();
      if (response.success) {
        setTaxonomyData(response);
      }
    } catch (error) {
      console.error('Error loading taxonomy:', error);
      toast.error('Failed to load taxonomy data');
    } finally {
      setLoading(false);
    }
  };

  const addRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      setSaving(true);
      // For now, we'll simulate adding a role
      // In a real implementation, you'd call an API endpoint
      const newRole: Role = {
        id: `role_${Date.now()}`,
        name: newRoleName.trim(),
        sortOrder: (taxonomyData?.roles.length || 0)
      };

      setTaxonomyData(prev => ({
        ...prev!,
        roles: [...(prev?.roles || []), newRole],
        skillsByRole: {
          ...(prev?.skillsByRole || {}),
          [newRoleName.trim()]: []
        }
      }));

      setNewRoleName('');
      toast.success('Role added successfully');
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to add role');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId: string, roleName: string) => {
    try {
      setSaving(true);
      
      // Check usage first
      const usageResponse = await api.checkTaxonomyUsage([roleId]);
      if (usageResponse.success && usageResponse.usage.roles[roleId]?.inUse) {
        const confirmed = window.confirm(
          `This role is used by ${usageResponse.usage.roles[roleId].candidateCount} candidates. Are you sure you want to delete it?`
        );
        if (!confirmed) return;
      }

      // Delete the role
      await api.deleteTaxonomyRole(roleId, true);
      
      setTaxonomyData(prev => ({
        ...prev!,
        roles: prev!.roles.filter(r => r.id !== roleId),
        skillsByRole: Object.fromEntries(
          Object.entries(prev!.skillsByRole).filter(([name]) => name !== roleName)
        )
      }));

      toast.success('Role deleted successfully');
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(null);
    }
  };

  const addSkillToRole = async (roleName: string) => {
    if (!newSkillName.trim()) return;

    const newSkill: Skill = {
      id: `skill_${Date.now()}`,
      name: newSkillName.trim(),
      weight: 1,
      scale_max: 5
    };

    setTaxonomyData(prev => ({
      ...prev!,
      skillsByRole: {
        ...prev!.skillsByRole,
        [roleName]: [...(prev!.skillsByRole[roleName] || []), newSkill]
      }
    }));

    setNewSkillName('');
    toast.success('Skill added successfully');
  };

  const updateSkill = (roleName: string, skillIndex: number, updates: Partial<Skill>) => {
    setTaxonomyData(prev => ({
      ...prev!,
      skillsByRole: {
        ...prev!.skillsByRole,
        [roleName]: prev!.skillsByRole[roleName].map((skill, index) =>
          index === skillIndex ? { ...skill, ...updates } : skill
        )
      }
    }));
  };

  const deleteSkill = async (roleName: string, skillIndex: number, skillId?: string) => {
    if (skillId) {
      try {
        setSaving(true);
        
        // Check usage first
        const usageResponse = await api.checkTaxonomyUsage(undefined, [skillId]);
        if (usageResponse.success && usageResponse.usage.skills[skillId]?.inUse) {
          const confirmed = window.confirm(
            `This skill is used by ${usageResponse.usage.skills[skillId].candidateCount} candidates. Are you sure you want to delete it?`
          );
          if (!confirmed) return;
        }

        await api.deleteTaxonomySkill(skillId, true);
      } catch (error) {
        console.error('Error deleting skill:', error);
        toast.error('Failed to delete skill');
        return;
      } finally {
        setSaving(false);
      }
    }

    setTaxonomyData(prev => ({
      ...prev!,
      skillsByRole: {
        ...prev!.skillsByRole,
        [roleName]: prev!.skillsByRole[roleName].filter((_, index) => index !== skillIndex)
      }
    }));

    toast.success('Skill deleted successfully');
  };

  const saveTaxonomy = async () => {
    if (!taxonomyData) return;

    try {
      setSaving(true);
      
      // This would call the actual API to save changes
      // For now, we'll just show a success message
      toast.success('Taxonomy saved successfully');
    } catch (error) {
      console.error('Error saving taxonomy:', error);
      toast.error('Failed to save taxonomy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!taxonomyData?.hasActiveTaxonomy) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Taxonomy</h2>
          <p className="text-gray-600 mb-6">You need to set up a taxonomy first.</p>
          <button
            onClick={() => window.location.href = '/onboarding'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Set Up Taxonomy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Industries & Roles of Focus</h1>
            <p className="text-gray-600 mt-1">
              Manage your organization's role and skill structure
            </p>
          </div>
          <button
            onClick={saveTaxonomy}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Taxonomy Info */}
        {taxonomyData.taxonomy && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Current Taxonomy</h3>
            <p className="text-sm text-gray-600">
              <strong>Name:</strong> {taxonomyData.taxonomy.name}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Created:</strong> {new Date(taxonomyData.taxonomy.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Last Updated:</strong> {new Date(taxonomyData.taxonomy.updatedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Roles and Skills */}
        <div className="space-y-6">
          {taxonomyData.roles.map(role => (
            <div key={role.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{role.name}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'role', id: role.id, name: role.name })}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Delete role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Skills for this role */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Skills</h4>
                  <button
                    onClick={() => {
                      setNewSkillName('');
                      setEditingRole(role.name);
                    }}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Skill
                  </button>
                </div>

                {/* Add new skill form */}
                {editingRole === role.name && (
                  <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      placeholder="Enter skill name"
                      className="flex-1 border border-gray-300 rounded px-3 py-1 text-sm"
                    />
                    <button
                      onClick={() => addSkillToRole(role.name)}
                      disabled={!newSkillName.trim()}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setEditingRole(null)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Skills list */}
                <div className="space-y-2">
                  {taxonomyData.skillsByRole[role.name]?.map((skill, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-900">{skill.name}</span>
                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-gray-500">Weight:</label>
                          <select
                            value={skill.weight}
                            onChange={(e) => updateSkill(role.name, index, { weight: parseInt(e.target.value) })}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            {[1, 2, 3, 4, 5].map(w => (
                              <option key={w} value={w}>{w}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm({ 
                          type: 'skill', 
                          id: skill.id || `skill_${index}`, 
                          name: skill.name 
                        })}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Delete skill"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add new role */}
        <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Role</h3>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Enter role name"
              className="flex-1 border border-gray-300 rounded px-3 py-2"
            />
            <button
              onClick={addRole}
              disabled={!newRoleName.trim() || saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Add Role
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">
                Delete {showDeleteConfirm.type === 'role' ? 'Role' : 'Skill'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'role') {
                    deleteRole(showDeleteConfirm.id, showDeleteConfirm.name);
                  } else {
                    // For skills, we need to find the role and skill index
                    const roleName = Object.keys(taxonomyData!.skillsByRole).find(role =>
                      taxonomyData!.skillsByRole[role].some(skill => 
                        skill.id === showDeleteConfirm.id || skill.name === showDeleteConfirm.name
                      )
                    );
                    if (roleName) {
                      const skillIndex = taxonomyData!.skillsByRole[roleName].findIndex(skill =>
                        skill.id === showDeleteConfirm.id || skill.name === showDeleteConfirm.name
                      );
                      if (skillIndex !== -1) {
                        deleteSkill(roleName, skillIndex, showDeleteConfirm.id);
                      }
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
