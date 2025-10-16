import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Search, Camera } from 'lucide-react';

interface StickyActionBarProps {
  onSearchClick: () => void;
  onImportClick: () => void;
  onCVUploadClick: () => void;
}

export default function StickyActionBar({ onSearchClick, onImportClick, onCVUploadClick }: StickyActionBarProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <div className="grid grid-cols-4 gap-2">
          {/* Search Button */}
          <button
            onClick={onSearchClick}
            className="flex flex-col items-center justify-center px-2 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Search className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Search</span>
          </button>

          {/* CV Upload Button */}
          <button
            onClick={onCVUploadClick}
            className="flex flex-col items-center justify-center px-2 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            <Camera className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">CV</span>
          </button>

          {/* Import Button */}
          <button
            onClick={onImportClick}
            className="flex flex-col items-center justify-center px-2 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Upload className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Import</span>
          </button>

          {/* Add Candidate Button */}
          <Link
            to="/candidates/new"
            className="flex flex-col items-center justify-center px-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Add</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
