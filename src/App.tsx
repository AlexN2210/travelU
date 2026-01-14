import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { JoinTripPage } from './components/JoinTripPage';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-body">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-dark-gray/70 font-body">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques */}
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" replace /> : <LandingPageWrapper />} 
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPageWrapper />} 
        />
        <Route 
          path="/signup" 
          element={user ? <Navigate to="/dashboard" replace /> : <SignupPageWrapper />} 
        />
        <Route 
          path="/join/:tripId" 
          element={<JoinTripPage />} 
        />

        {/* Routes protégées */}
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/trip/:tripId" 
          element={user ? <TripViewWrapper /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="*" 
          element={<Navigate to={user ? "/dashboard" : "/"} replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

// Wrappers pour les pages publiques (pour éviter les props manquantes)
function LandingPageWrapper() {
  return (
    <LandingPage
      onGetStarted={() => window.location.href = '/signup'}
      onLogin={() => window.location.href = '/login'}
    />
  );
}

function LoginPageWrapper() {
  return (
    <LoginPage
      onSwitchToSignup={() => window.location.href = '/signup'}
      onBack={() => window.location.href = '/'}
    />
  );
}

function SignupPageWrapper() {
  return (
    <SignupPage
      onSwitchToLogin={() => window.location.href = '/login'}
      onBack={() => window.location.href = '/'}
    />
  );
}

function TripViewWrapper() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  
  if (!tripId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <TripView
      tripId={tripId}
      onBack={() => navigate('/dashboard')}
    />
  );
}

export default App;
