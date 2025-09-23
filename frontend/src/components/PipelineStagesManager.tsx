import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Save,
  X,
  AlertTriangle
} from 'lucide-react';
import { api, PipelineStage } from '../lib/api';
import toast from 'react-hot-toast';

interface PipelineStagesManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onStagesUpdated: () => void;
}

const COLOR_OPTIONS = [
  { value: 'bg-gray-100', border: 'border-gray-200', label: 'Gray' },
  { value: 'bg-blue-100', border: 'border-blue-200', label: 'Blue' },
  { value: 'bg-green-100', border: 'border-green-200', label: 'Green' },
  { value: 'bg-yellow-100', border: 'border-yellow-200', label: 'Yellow' },
  { value: 'bg-orange-100', border: 'border-orange-200', label: 'Orange' },
  { value: 'bg-red-100', border: 'border-red-200', label: 'Red' },
  { value: 'bg-purple-100', border: 'border-purple-200', label: 'Purple' },
  { value: 'bg-indigo-100', border: 'border-indigo-200', label: 'Indigo' },
  { value: 'bg-emerald-100', border: 'border-emerald-200', label: 'Emerald' },
  { value: 'bg-pink-100', border: 'border-pink-200', label: 'Pink' },
];

export default function PipelineStagesManager({ isOpen, onClose, onStagesUpdated }: PipelineStagesManagerProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [newStage, setNewStage] = useState({ name: '', color: 'bg-gray-100', border_color: 'border-gray-200' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStages();
    }
  }, [isOpen]);

  const loadStages = async () => {
    try {
      setLoading(true);
      const stagesData = await api.getPipelineStages();
      setStages(stagesData);
    } catch (error) {
      toast.error('Failed to load pipeline stages');
      console.error('Error loading stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStage.name.trim()) return;

    try {
      await api.createPipelineStage(newStage);
      toast.success('Pipeline stage created successfully');
      setNewStage({ name: '', color: 'bg-gray-100', border_color: 'border-gray-200' });
      setShowAddForm(false);
      loadStages();
      onStagesUpdated();
    } catch (error) {
      toast.error('Failed to create pipeline stage');
      console.error('Error creating stage:', error);
    }
  };

  const handleUpdateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage || !editingStage.name.trim()) return;

    // Don't allow editing the first stage
    if (editingStage.is_first) {
      toast.error('Cannot edit the first stage (New Opportunities)');
      return;
    }

    try {
      await api.updatePipelineStage(editingStage.id, {
        name: editingStage.name,
        color: editingStage.color,
        border_color: editingStage.border_color
      });
      toast.success('Pipeline stage updated successfully');
      setEditingStage(null);
      loadStages();
      onStagesUpdated();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update pipeline stage';
      toast.error(errorMessage);
      console.error('Error updating stage:', error);
    }
  };

  const handleDeleteStage = async (stage: PipelineStage) => {
    if (stage.is_first) {
      toast.error('Cannot delete the first stage (New Opportunities)');
      return;
    }

    if (stage.is_default) {
      toast.error('Cannot delete default pipeline stages');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${stage.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deletePipelineStage(stage.id);
      toast.success('Pipeline stage deleted successfully');
      loadStages();
      onStagesUpdated();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete pipeline stage';
      toast.error(errorMessage);
      console.error('Error deleting stage:', error);
    }
  };

  const handleReorder = async (newStages: PipelineStage[]) => {
    try {
      const reorderData = newStages.map((stage, index) => ({
        id: stage.id,
        position: index
      }));
      await api.reorderPipelineStages(reorderData);
      setStages(newStages);
      onStagesUpdated();
    } catch (error) {
      toast.error('Failed to reorder pipeline stages');
      console.error('Error reordering stages:', error);
    }
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newStages = [...stages];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Don't allow moving the first stage
    if (newStages[index].is_first) {
      toast.error('Cannot move the first stage (New Opportunities)');
      return;
    }
    
    if (newIndex < 0 || newIndex >= newStages.length) return;
    
    // Don't allow moving other stages to position 0 (first position)
    if (newIndex === 0) {
      toast.error('Cannot move stages to the first position (reserved for New Opportunities)');
      return;
    }
    
    [newStages[index], newStages[newIndex]] = [newStages[newIndex], newStages[index]];
    handleReorder(newStages);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Manage Pipeline Stages</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add New Stage Form */}
              {showAddForm && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Stage</h3>
                  <form onSubmit={handleCreateStage} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage Name
                      </label>
                      <input
                        type="text"
                        value={newStage.name}
                        onChange={(e) => setNewStage(prev => ({ ...prev, name: e.target.value }))}
                        className="input"
                        placeholder="Enter stage name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setNewStage(prev => ({ 
                              ...prev, 
                              color: color.value, 
                              border_color: color.border 
                            }))}
                            className={`p-2 rounded border-2 ${
                              newStage.color === color.value 
                                ? 'border-primary-500' 
                                : 'border-gray-200'
                            } ${color.value} ${color.border}`}
                          >
                            <span className="text-xs text-gray-700">{color.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Create Stage
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="btn btn-outline btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Stages List */}
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className={`flex items-center p-4 rounded-lg border ${stage.color} ${stage.border_color}`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <GripVertical className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        {editingStage?.id === stage.id ? (
                          <form onSubmit={handleUpdateStage} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingStage.name}
                              onChange={(e) => setEditingStage(prev => 
                                prev ? { ...prev, name: e.target.value } : null
                              )}
                              className="input input-sm flex-1"
                              required
                            />
                            <div className="flex space-x-1">
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                              >
                                <Save className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStage(null)}
                                className="btn btn-outline btn-sm"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{stage.name}</span>
                            {stage.is_first && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                                First Stage
                              </span>
                            )}
                            {stage.is_default && !stage.is_first && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => moveStage(index, 'up')}
                        disabled={index === 0 || stage.is_first}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveStage(index, 'down')}
                        disabled={index === stages.length - 1 || stage.is_first}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setEditingStage(stage)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        disabled={stage.is_first || stage.is_default}
                        title={stage.is_first ? 'Cannot edit first stage' : stage.is_default ? 'Cannot edit default stages' : 'Edit stage'}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStage(stage)}
                        className="p-1 text-red-400 hover:text-red-600"
                        disabled={stage.is_first || stage.is_default}
                        title={stage.is_first ? 'Cannot delete first stage' : stage.is_default ? 'Cannot delete default stages' : 'Delete stage'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Stage Button */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus className="h-5 w-5 mx-auto mb-2" />
                  Add New Stage
                </button>
              )}

              {/* Warning for stages */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Stage Management Rules</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>The first stage "New Opportunities" cannot be edited, deleted, or moved</li>
                      <li>Default stages cannot be renamed or deleted, but can be reordered</li>
                      <li>Custom stages can be fully managed (edit, delete, reorder)</li>
                      <li>New opportunities automatically go to the first stage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





