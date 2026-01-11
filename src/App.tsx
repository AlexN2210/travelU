import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { Dashboard } from './components/Dashboard';

type Page = 'landing' | 'login' | 'signup' | 'dashboard';

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  if (currentPage === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setCurrentPage('signup')}
        onLogin={() => setCurrentPage('login')}
      />
    );
  }

  if (currentPage === 'login') {
    return (
      <LoginPage
        onSwitchToSignup={() => setCurrentPage('signup')}
        onBack={() => setCurrentPage('landing')}
      />
    );
  }

  if (currentPage === 'signup') {
    return (
      <SignupPage
        onSwitchToLogin={() => setCurrentPage('login')}
        onBack={() => setCurrentPage('landing')}
      />
    );
  }

  return null;
}

export default App;
