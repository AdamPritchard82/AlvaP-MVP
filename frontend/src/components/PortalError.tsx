import React from 'react';

interface PortalErrorProps {
  error: string;
}

export default function PortalError({ error }: PortalErrorProps) {
  const isTokenError = error.toLowerCase().includes('token') || 
                      error.toLowerCase().includes('expired') || 
                      error.toLowerCase().includes('invalid');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {isTokenError ? 'Access Denied' : 'Portal Error'}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {error}
        </p>
        
        {isTokenError ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              <p>This could be because:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Your portal link has expired (links are valid for 24 hours)</li>
                <li>The link has already been used</li>
                <li>The link is invalid or corrupted</li>
              </ul>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3">
                Please contact your recruitment consultant to request a new portal link.
              </p>
              <a
                href="mailto:support@alvap.com"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Contact Support
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              We're experiencing technical difficulties. Please try again later.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-blue-600">AlvaP</span>
          </p>
        </div>
      </div>
    </div>
  );
}
