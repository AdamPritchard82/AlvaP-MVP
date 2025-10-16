import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountDeletionModal({ isOpen, onClose }: AccountDeletionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const { logout } = useAuth();

  const requiredText = 'DELETE MY ACCOUNT';
  const isConfirmationValid = confirmationText === requiredText;

  const handleDeleteAccount = async () => {
    if (!isConfirmationValid) return;

    setIsDeleting(true);
    try {
      const response = await api.deleteAccount();
      
      if (response.success) {
        toast.success('Account deleted successfully');
        logout();
        onClose();
      } else {
        throw new Error(response.error || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setStep('warning');
    setConfirmationText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'warning' ? (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    ⚠️ This action cannot be undone
                  </h4>
                  <p className="text-sm text-red-700">
                    Deleting your account will permanently remove:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 ml-4 list-disc space-y-1">
                    <li>All your candidate data</li>
                    <li>All your job postings</li>
                    <li>All your settings and preferences</li>
                    <li>All your billing information</li>
                    <li>All your account history</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    💡 Consider these alternatives
                  </h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Export your data before deleting</li>
                    <li>• Contact support if you're having issues</li>
                    <li>• Pause your subscription instead</li>
                  </ul>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Continue to Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    🚨 Final Confirmation Required
                  </h4>
                  <p className="text-sm text-red-700">
                    This is your last chance to cancel. Once you confirm, your account and all data will be permanently deleted.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{requiredText}</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={requiredText}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    autoComplete="off"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setStep('warning')}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={!isConfirmationValid || isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account Forever
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
