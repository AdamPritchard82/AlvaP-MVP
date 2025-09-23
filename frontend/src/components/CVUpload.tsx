import { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface CVUploadProps {
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
  parsing?: boolean;
}

export default function CVUpload({ onUpload, onRemove, className = '', disabled = false, parsing = false }: CVUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ['.pdf', '.docx', '.txt'];
  const maxSize = 20 * 1024 * 1024; // 20MB

  const validateFile = (file: File): boolean => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      toast.error('Please upload a PDF, DOCX, or TXT file');
      return false;
    }
    if (file.size > maxSize) {
      toast.error('File size must be less than 20MB');
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    if (!validateFile(file)) return;
    
    setUploading(true);
    setUploadedFile(file);
    
    try {
      await onUpload(file);
      toast.success('CV uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload CV');
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  if (uploadedFile) {
    return (
      <div className={`border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-6 text-center ${className}`}>
        <div className="flex items-center justify-center mb-2">
          {parsing ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          ) : (
            <CheckCircle className="h-8 w-8 text-green-500" />
          )}
        </div>
        <p className="text-sm font-medium text-green-800 mb-1">
          {parsing ? 'Parsing CV...' : 'CV Uploaded'}
        </p>
        <p className="text-xs text-green-600 mb-3">{uploadedFile.name}</p>
        <button
          onClick={handleRemove}
          disabled={disabled || parsing}
          className="inline-flex items-center px-3 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-white hover:bg-green-50 disabled:opacity-50"
        >
          <X className="h-3 w-3 mr-1" />
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragOver
          ? 'border-primary-400 bg-primary-50'
          : 'border-gray-300 hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
      
      {uploading ? (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
          <p className="text-sm text-gray-600">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Upload className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            Drop your CV here, or click to browse
          </p>
          <p className="text-xs text-gray-500">
            Supports PDF, DOCX, TXT files up to 20MB
          </p>
        </div>
      )}
    </div>
  );
}



