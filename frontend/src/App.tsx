import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { TaxonomyGuard } from './components/TaxonomyGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LibraryEntry, { LibrarySkills, LibraryBands, LibraryCandidates } from './pages/Library';
import Candidates from './pages/Candidates';
import CandidateNew from './pages/CandidateNew';
import CandidateDetail from './pages/CandidateDetail';
import JobNew from './pages/JobNew';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import UpdatesAndOpenRoles from './pages/UpdatesAndOpenRoles';
import Clients from './pages/Clients';
import ClientNew from './pages/ClientNew';
import Pricing from './pages/Pricing';
import Analytics from './pages/Analytics';
import Portal from './pages/Portal';
import PublicJobs from './pages/PublicJobs';
import PublicJobDetail from './pages/PublicJobDetail';
import TaxonomySettings from './pages/TaxonomySettings';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Temporarily disable taxonomy guard to ensure login works
  // TODO: Re-enable once backend is properly deployed
  const useTaxonomyGuard = false;
  
  if (useTaxonomyGuard) {
    return (
      <TaxonomyGuard>
        {children}
      </TaxonomyGuard>
    );
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/public/jobs" element={<PublicJobs />} />
      <Route path="/public/jobs/:slug" element={<PublicJobDetail />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <InternalRoutes />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function InternalRoutes() {
  const navigate = useNavigate();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      {/* /candidates shows the classic Candidates page (now embeds Library tiles) */}
      <Route path="/candidates" element={<Candidates />} />
      <Route path="/candidates/new" element={<CandidateNew />} />
      <Route path="/candidates/:candidateId" element={<CandidateDetail />} />
      <Route path="/jobs" element={<Jobs />} />
      <Route path="/jobs/new" element={<JobNew />} />
      <Route path="/jobs/:id/detail" element={<JobDetail />} />
      <Route path="/updates" element={<UpdatesAndOpenRoles />} />
      <Route path="/library" element={<LibrarySkills />} />
      <Route path="/library/:skill" element={<LibraryBands />} />
      <Route path="/library/:skill/:band" element={<LibraryCandidates />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/clients/new" element={<ClientNew />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/settings/taxonomy" element={<TaxonomySettings />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

function App() {
  // Add boot logging to debug the issue
  console.log('APP_BOOT', { 
    mode: import.meta.env.MODE, 
    base: import.meta.env.BASE_URL,
    timestamp: new Date().toISOString()
  });

  // Add a small delay to ensure everything is loaded
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <AppRoutes />
            <Toaster position="top-right" />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

