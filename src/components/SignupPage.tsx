import { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../public/logo.png';

interface SignupPageProps {
  onSwitchToLogin: () => void;
  onBack: () => void;
}

export function SignupPage({ onSwitchToLogin, onBack }: SignupPageProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password);

      if (error) {
        console.error('Erreur d\'inscription complète:', error);
        // Afficher le message d'erreur détaillé
        const errorMessage = error.message || error.toString();
        const errorStatus = (error as any).status;
        
        console.log('Détails de l\'erreur:', {
          message: errorMessage,
          status: errorStatus,
          name: error.name,
          stack: (error as any).stack
        });
        
        if (errorStatus === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          setError(
            'Erreur 401: Problème d\'authentification.\n' +
            'Vérifiez:\n' +
            '1. Que les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont correctes dans .env\n' +
            '2. Que vous avez redémarré le serveur après avoir modifié .env\n' +
            '3. Que la confirmation email est désactivée dans Supabase (Auth → Settings) pour le développement\n' +
            '4. Vérifiez la console du navigateur pour plus de détails'
          );
        } else if (errorMessage.includes('already registered') || errorMessage.includes('already exists') || errorMessage.includes('User already registered')) {
          setError('Cette adresse email est déjà utilisée. Essayez de vous connecter.');
        } else if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
          setError('Adresse email ou mot de passe invalide');
        } else if (errorMessage.includes('Email rate limit') || errorMessage.includes('too many')) {
          setError('Trop de tentatives. Veuillez attendre quelques minutes.');
        } else {
          setError(`Erreur: ${errorMessage}${errorStatus ? ` (Status: ${errorStatus})` : ''}`);
        }
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err) {
      console.error('Exception lors de l\'inscription:', err);
      setError('Une erreur inattendue s\'est produite. Vérifiez la console pour plus de détails.');
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
          <h2 className="text-2xl font-heading font-semibold text-dark-gray">Inscription</h2>
          <p className="text-dark-gray/70 font-body mt-2">
            Créez votre compte pour commencer
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-medium p-8">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-palm-green mx-auto mb-4" />
              <h3 className="text-xl font-heading font-semibold text-dark-gray mb-2">
                Compte créé avec succès
              </h3>
              <p className="text-dark-gray/70 font-body mb-6">
                Vous pouvez maintenant vous connecter
              </p>
              <button
                onClick={onSwitchToLogin}
                className="px-6 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
              >
                Se connecter
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-button p-3 flex items-center space-x-2 text-burnt-orange font-body">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm whitespace-pre-line">{error}</span>
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

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {loading ? 'Création...' : 'Créer mon compte'}
                </button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button
                  onClick={onSwitchToLogin}
                  className="text-turquoise hover:text-turquoise/80 font-body font-medium transition-colors"
                >
                  Déjà un compte ? Se connecter
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
