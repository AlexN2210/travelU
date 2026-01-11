import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../public/logo.png';

interface LoginPageProps {
  onSwitchToSignup: () => void;
  onBack: () => void;
}

export function LoginPage({ onSwitchToSignup, onBack }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream font-body flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img 
              src={logo} 
              alt="TravelU Logo" 
              className="w-10 h-10 object-contain"
            />
            <h1 className="text-3xl font-heading font-bold text-dark-gray">TravelU</h1>
          </div>
          <h2 className="text-2xl font-heading font-semibold text-dark-gray">Connexion</h2>
          <p className="text-dark-gray/70 font-body mt-2">
            Connectez-vous pour accéder à vos voyages
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-medium p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-button p-3 flex items-center space-x-2 text-burnt-orange font-body">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent transition-colors font-body"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent transition-colors font-body"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none tracking-wide"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button
              onClick={onSwitchToSignup}
              className="text-turquoise hover:text-turquoise/80 font-body font-medium transition-colors"
            >
              Pas encore de compte ? S'inscrire
            </button>
            <div>
              <button
                onClick={onBack}
                className="text-dark-gray/70 hover:text-dark-gray font-body transition-colors"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
