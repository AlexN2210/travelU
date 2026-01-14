import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import logo from '../public/logo.png';

export function JoinTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripName, setTripName] = useState('');
  const [tripExists, setTripExists] = useState(false);

  // Vérifier que le voyage existe
  useEffect(() => {
    const checkTrip = async () => {
      if (!tripId) {
        setError('ID de voyage invalide');
        setTripLoading(false);
        return;
      }

      // Utiliser la fonction PostgreSQL pour vérifier l'existence du voyage
      // Cela fonctionne même pour les utilisateurs non authentifiés
      const { data: tripData, error: tripError } = await supabase
        .rpc('check_trip_exists', { trip_uuid: tripId });

      if (tripError) {
        console.error('Erreur lors de la vérification du voyage:', tripError);
        setError('Erreur lors de la vérification du voyage. Le lien d\'invitation est peut-être invalide.');
        setTripExists(false);
      } else if (!tripData || !tripData.exists) {
        setError('Voyage introuvable. Le lien d\'invitation est peut-être invalide.');
        setTripExists(false);
      } else {
        setTripName(tripData.name || 'Voyage');
        setTripExists(true);
      }
      setTripLoading(false);
    };

    checkTrip();
  }, [tripId]);

  // Si l'utilisateur est déjà connecté, l'ajouter directement au voyage
  useEffect(() => {
    const addExistingUserToTrip = async () => {
      if (user && tripId && tripExists) {
        setLoading(true);
        try {
          // Utiliser la fonction PostgreSQL pour s'ajouter au voyage
          const { data: joinData, error: joinError } = await supabase
            .rpc('join_trip_via_invite', { trip_uuid: tripId });

          if (joinError) {
            console.error('Erreur lors de l\'ajout au voyage:', joinError);
            setError('Erreur lors de l\'ajout au voyage. Veuillez réessayer.');
            setLoading(false);
            return;
          }

          if (joinData && !joinData.success) {
            if (joinData.error === 'Vous êtes déjà participant à ce voyage') {
              setError('Vous êtes déjà participant à ce voyage.');
            } else {
              setError(joinData.error || 'Erreur lors de l\'ajout au voyage.');
            }
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
            setLoading(false);
            return;
          }

          setSuccess(true);
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        } catch (err) {
          console.error('Exception lors de l\'ajout au voyage:', err);
          setError('Une erreur inattendue s\'est produite.');
        } finally {
          setLoading(false);
        }
      }
    };

    addExistingUserToTrip();
  }, [user, tripId, tripExists, navigate]);

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

    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont requis');
      return;
    }

    setLoading(true);
    try {
      // Créer le compte utilisateur
      const { data: signUpData, error: signUpError } = await signUp(email, password);

      if (signUpError) {
        const errorMessage = signUpError.message || signUpError.toString();
        
        if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
          setError('Cette adresse email est déjà utilisée. Veuillez vous connecter.');
        } else {
          setError(`Erreur lors de l'inscription: ${errorMessage}`);
        }
        setLoading(false);
        return;
      }

      // Attendre que l'utilisateur soit créé et connecté
      if (signUpData?.user && tripId) {
        // Attendre un peu pour que la session soit bien établie
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Utiliser la fonction PostgreSQL pour s'ajouter au voyage
        const { data: joinData, error: joinError } = await supabase
          .rpc('join_trip_via_invite', { trip_uuid: tripId });

        if (joinError) {
          console.error('Erreur lors de l\'ajout au voyage:', joinError);
          setError('Compte créé avec succès, mais erreur lors de l\'ajout au voyage. Vous pouvez accéder au voyage depuis votre tableau de bord.');
        } else if (joinData && !joinData.success) {
          console.error('Erreur lors de l\'ajout au voyage:', joinData.error);
          setError(`Compte créé avec succès, mais ${joinData.error || 'erreur lors de l\'ajout au voyage'}. Vous pouvez accéder au voyage depuis votre tableau de bord.`);
        } else {
          setSuccess(true);
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Exception lors de l\'inscription:', err);
      setError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (tripLoading) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center px-4 py-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-turquoise animate-spin mx-auto mb-4" />
          <p className="text-dark-gray/70 font-body">Vérification du voyage...</p>
        </div>
      </div>
    );
  }

  if (!tripExists) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-medium p-8 text-center">
          <AlertCircle className="w-16 h-16 text-burnt-orange mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-dark-gray mb-2">
            Voyage introuvable
          </h2>
          <p className="text-dark-gray/70 font-body mb-6">
            {error || 'Le lien d\'invitation est invalide ou le voyage n\'existe plus.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-turquoise text-white font-body font-semibold rounded-button hover:bg-turquoise/90 transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream font-body flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-medium p-8 text-center">
          <CheckCircle className="w-16 h-16 text-palm-green mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-dark-gray mb-2">
            Bienvenue dans le voyage !
          </h2>
          <p className="text-dark-gray/70 font-body mb-6">
            Vous avez été ajouté au voyage "{tripName}". Redirection en cours...
          </p>
          <Loader2 className="w-8 h-8 text-turquoise animate-spin mx-auto" />
        </div>
      </div>
    );
  }

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
          <h2 className="text-2xl font-heading font-semibold text-dark-gray">Rejoindre le voyage</h2>
          <p className="text-dark-gray/70 font-body mt-2">
            Créez votre compte pour rejoindre "{tripName}"
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-medium p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-button p-3 flex items-center space-x-2 text-burnt-orange font-body">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm whitespace-pre-line">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                  Prénom *
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent transition-colors font-body"
                  placeholder="Jean"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                  Nom *
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent transition-colors font-body"
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-gray mb-2 font-body">
                Email *
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
                Mot de passe *
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
                Confirmer le mot de passe *
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
              {loading ? 'Création du compte...' : 'Créer mon compte et rejoindre'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-dark-gray/70 font-body mb-2">
              Déjà un compte ?
            </p>
            <button
              onClick={() => navigate('/login')}
              className="text-turquoise hover:text-turquoise/80 font-body font-medium transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
