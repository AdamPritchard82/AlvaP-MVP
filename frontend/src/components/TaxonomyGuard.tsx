import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import FocusSetupWizard from './FocusSetupWizard';

// Feature flag for taxonomy editor
const TAXONOMY_EDITOR_ENABLED = process.env.REACT_APP_TAXONOMY_EDITOR_ENABLED !== 'false';

interface TaxonomyGuardProps {
  children: React.ReactNode;
}

export function TaxonomyGuard({ children }: TaxonomyGuardProps) {
  const [loading, setLoading] = useState(true);
  const [hasActiveTaxonomy, setHasActiveTaxonomy] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    checkTaxonomyStatus();
  }, []);

  const checkTaxonomyStatus = async () => {
    // If taxonomy editor is disabled, skip the check
    if (!TAXONOMY_EDITOR_ENABLED) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getActiveFocus();
      if (response.success) {
        setHasActiveTaxonomy(response.hasActiveFocus);
        // Only show wizard if explicitly no focus exists, not on API errors
        if (!response.hasActiveFocus) {
          setShowWizard(true);
        }
      } else {
        // If API returns success: false, assume no focus
        setHasActiveTaxonomy(false);
        setShowWizard(true);
      }
    } catch (error) {
      console.error('Error checking focus status:', error);
      // If there's an error, don't block access - just assume no focus
      setHasActiveTaxonomy(false);
      // Don't show wizard on API errors to avoid blocking access
      // setShowWizard(true);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    setHasActiveTaxonomy(true);
    // Reload the page to refresh all components with the new taxonomy
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (showWizard) {
    return <FocusSetupWizard isOpen={true} onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />;
  }

  return <>{children}</>;
}
