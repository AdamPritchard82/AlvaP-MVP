import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Settings, CreditCard, Sparkles } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay for smooth animation
      setTimeout(() => setIsVisible(true), 100);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`relative transform overflow-hidden rounded-lg bg-white px-6 pt-5 pb-6 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg ${
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Content */}
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900">
                Welcome to AlvaP! 🎉
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Get started by configuring your focus areas and exploring our pricing options.
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-6 space-y-3">
              <Link
                to="/settings/taxonomy"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configure Focus (Taxonomy)
              </Link>
              
              <Link
                to="/settings/billing"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                View Pricing (Billing)
              </Link>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              You can access these settings anytime from the sidebar menu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
