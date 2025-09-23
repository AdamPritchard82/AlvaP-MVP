import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import CandidateNew from './pages/CandidateNew';
import CandidateDetail from './pages/CandidateDetail';
import Jobs from './pages/Jobs';
import JobNew from './pages/JobNew';
import JobDetail from './pages/JobDetail';
import UpdatesAndOpenRoles from './pages/UpdatesAndOpenRoles';
import Clients from './pages/Clients';
import ClientNew from './pages/ClientNew';
import Pricing from './pages/Pricing';

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

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/candidates" element={<Candidates />} />
                <Route path="/candidates/new" element={<CandidateNew />} />
                <Route path="/candidates/:candidateId" element={<CandidateDetail />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/new" element={<JobNew />} />
                <Route path="/jobs/:jobId" element={<JobDetail />} />
                <Route path="/updates" element={<UpdatesAndOpenRoles />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/new" element={<ClientNew />} />
                <Route path="/pricing" element={<Pricing />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
          <Toaster position="top-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

