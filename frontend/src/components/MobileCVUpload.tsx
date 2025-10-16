import React, { useState, useRef } from 'react';
import { Camera, Upload, File, X, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface MobileCVUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (candidate: any) => void;
}

export default function MobileCVUpload({ isOpen, onClose, onUploadSuccess }: MobileCVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const maxRetries = 3;

  const handleFileSelect = (file: File) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please select a PDF or Word document');
      setUploadStatus('error');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size must be less than 10MB');
      setUploadStatus('error');
      return;
    }

    setUploadedFile(file);
    setErrorMessage('');
    setUploadStatus('idle');
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      // Parse CV using the API
      const parseResult = await api.parseCV(file);
      
      if (parseResult.success && parseResult.data) {
        // Create candidate with parsed data
        const candidateData = {
          full_name: parseResult.data.full_name || 'Unknown',
          email: parseResult.data.email || '',
          phone: parseResult.data.phone || '',
          current_title: parseResult.data.current_title || '',
          current_employer: parseResult.data.current_employer || '',
          salary_min: parseResult.data.salary_min || null,
          salary_max: parseResult.data.salary_max || null,
          skills: parseResult.data.skills || {
            communications: false,
            campaigns: false,
            policy: false,
            publicAffairs: false
          },
          tags: parseResult.data.tags || [],
          notes: `CV uploaded via mobile - Parser: ${parseResult.parserUsed || 'Unknown'}`
        };

        const createResult = await api.createCandidate(candidateData);
        
        if (createResult.success) {
          setUploadStatus('success');
          setTimeout(() => {
            onUploadSuccess(createResult);
            handleClose();
          }, 1500);
        } else {
          throw new Error(createResult.message || 'Failed to create candidate');
        }
      } else {
        throw new Error(parseResult.error || 'Failed to parse CV');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'Upload failed');
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    if (uploadedFile && retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      handleFileUpload(uploadedFile);
    }
  };

  const handleClose = () => {
    setUploadedFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
    setRetryCount(0);
    onClose();
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={handleClose}
      />
      
      {/* Upload Modal */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg shadow-xl z-50 md:hidden max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upload CV</h3>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {uploadStatus === 'idle' && !uploadedFile && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Choose how you'd like to upload a CV
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Camera Option */}
                <button
                  onClick={handleCameraCapture}
                  className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Camera className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">Take Photo</span>
                  <span className="text-xs text-gray-500 mt-1">Capture document</span>
                </button>

                {/* File Option */}
                <button
                  onClick={handleFileSelectClick}
                  className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <File className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">Choose File</span>
                  <span className="text-xs text-gray-500 mt-1">PDF or Word</span>
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Supported formats: PDF, DOC, DOCX (max 10MB)
              </div>
            </div>
          )}

          {uploadedFile && uploadStatus === 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <File className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => handleFileUpload(uploadedFile)}
                disabled={uploading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload CV'}
              </button>
            </div>
          )}

          {uploadStatus === 'uploading' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Processing CV...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a few moments</p>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">CV Uploaded Successfully!</p>
              <p className="text-xs text-gray-500">Candidate has been added to your database</p>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">Upload Failed</p>
              <p className="text-xs text-red-600 mb-4">{errorMessage}</p>
              
              {retryCount < maxRetries && (
                <div className="space-y-2">
                  <button
                    onClick={handleRetry}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry ({retryCount + 1}/{maxRetries})
                  </button>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="w-full py-2 px-4 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Try Different File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
      </div>
    </>
  );
}
