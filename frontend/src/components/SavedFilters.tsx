import { useState, useEffect } from 'react';
import { api, SavedFilter } from '../lib/api';

interface SavedFiltersProps {
  currentFilter?: {
    skill?: string;
    band?: string;
    searchKeyword?: string;
    columns?: any[];
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
    filters?: any;
  };
  onApplyFilter: (filter: SavedFilter) => void;
  onSaveCurrentView: () => void;
}

export function SavedFilters({ currentFilter, onApplyFilter, onSaveCurrentView }: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    try {
      const response = await api.getSavedFilters();
      setSavedFilters(response.filters || []);
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) return;

    try {
      const response = await api.saveFilter({
        name: filterName.trim(),
        ...currentFilter
      });
      
      setSavedFilters(prev => [...prev, response.filter]);
      setFilterName('');
      setShowSaveDialog(false);
      
      // Show toast
      showToast('Filter saved successfully');
    } catch (error) {
      console.error('Failed to save filter:', error);
      showToast('Failed to save filter', 'error');
    }
  };

  const handleApplyFilter = async (filter: SavedFilter) => {
    try {
      await api.applySavedFilter(filter.id);
      onApplyFilter(filter);
      showToast(`Applied filter: ${filter.name}`);
    } catch (error) {
      console.error('Failed to apply filter:', error);
      showToast('Failed to apply filter', 'error');
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    try {
      await api.deleteSavedFilter(filterId);
      setSavedFilters(prev => prev.filter(f => f.id !== filterId));
      showToast('Filter deleted');
    } catch (error) {
      console.error('Failed to delete filter:', error);
      showToast('Failed to delete filter', 'error');
    }
  };

  const handleRenameFilter = async (filterId: string, newName: string) => {
    try {
      await api.updateSavedFilter(filterId, { name: newName });
      setSavedFilters(prev => prev.map(f => 
        f.id === filterId ? { ...f, name: newName } : f
      ));
      showToast('Filter renamed');
    } catch (error) {
      console.error('Failed to rename filter:', error);
      showToast('Failed to rename filter', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    // Simple toast implementation - in production, use a proper toast library
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading saved filters...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Save Current View Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSaveDialog(true)}
          className="btn btn-sm btn-outline"
          disabled={!currentFilter}
        >
          💾 Save Current View
        </button>
        
        {savedFilters.length > 0 && (
          <button
            onClick={() => setShowManage(!showManage)}
            className="btn btn-sm btn-ghost"
          >
            {showManage ? 'Hide' : 'Manage'} Filters
          </button>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Save Current View</h3>
            <input
              type="text"
              placeholder="Filter name (e.g., 'PA £90k + comms keyword')"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveFilter}
                disabled={!filterName.trim()}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Filters List */}
      {savedFilters.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Saved Filters</h4>
          <div className="space-y-1">
            {savedFilters.map(filter => (
              <div key={filter.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <button
                  onClick={() => handleApplyFilter(filter)}
                  className="flex-1 text-left text-sm hover:bg-gray-100 p-1 rounded"
                >
                  {filter.name}
                </button>
                
                {showManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const newName = prompt('Rename filter:', filter.name);
                        if (newName && newName.trim() !== filter.name) {
                          handleRenameFilter(filter.id, newName.trim());
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete filter "${filter.name}"?`)) {
                          handleDeleteFilter(filter.id);
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {savedFilters.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No saved filters yet. Save your current view to get started.
        </div>
      )}
    </div>
  );
}
