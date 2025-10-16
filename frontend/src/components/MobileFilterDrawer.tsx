import React from 'react';
import { X, Filter, Tag, DollarSign, Check } from 'lucide-react';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  children: React.ReactNode;
  activeFilterCount: number;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  onApplyFilters,
  onClearFilters,
  children,
  activeFilterCount
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg shadow-xl z-50 md:hidden max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {children}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={onClearFilters}
              className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={() => {
                onApplyFilters();
                onClose();
              }}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
