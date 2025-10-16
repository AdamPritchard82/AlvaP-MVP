import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Search } from 'lucide-react';

interface StickyActionBarProps {
  onSearchClick: () => void;
  onImportClick: () => void;
}

export default function StickyActionBar({ onSearchClick, onImportClick }: StickyActionBarProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between space-x-3">
          {/* Search Button */}
          <button
            onClick={onSearchClick}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Search className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Search</span>
          </button>

          {/* Import Button */}
          <button
            onClick={onImportClick}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Upload className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Import</span>
          </button>

          {/* Add Candidate Button */}
          <Link
            to="/candidates/new"
            className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Add</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
