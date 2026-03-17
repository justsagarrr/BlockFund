import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import CampaignerDashboard from './pages/CampaignerDashboard.jsx';
import InvestorDashboard from './pages/InvestorDashboard.jsx';
import CreateCampaign from './pages/CreateCampaign.jsx';
import Discover from './pages/Discover.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function ProtectedRoute({ children, allowedRole }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'campaigner') {
    return <CampaignerDashboard />;
  }
  return <InvestorDashboard />;
}

function LandingRedirect() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/discover" element={
          <ProtectedRoute>
            <Discover />
          </ProtectedRoute>
        } />

        <Route path="/create" element={
          <ProtectedRoute allowedRole="campaigner">
            <CreateCampaign />
          </ProtectedRoute>
        } />

        <Route path="/campaign/:id" element={
          <ProtectedRoute>
            <CampaignDetail />
          </ProtectedRoute>
        } />

        <Route path="/portfolio" element={
          <ProtectedRoute allowedRole="investor">
            <Portfolio />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
