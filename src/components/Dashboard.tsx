import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, MapPin, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CityAutocomplete } from './CityAutocomplete';
import logo from '../public/logo.png';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  type: 'single' | 'roadtrip';
  creator_id: string;
  created_at: string;
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    
    // Essayer d'abord avec la fonction PostgreSQL qui évite la récursion
    const { data: functionData, error: functionError } = await supabase.rpc('get_user_trips');
    
    if (!functionError && functionData) {
      // Trier par date de création décroissante
      const sortedTrips = functionData.sort((a: Trip, b: Trip) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      setTrips(sortedTrips);
      setLoading(false);
      return;
    }
    
    // Si la fonction n'existe pas, utiliser la méthode classique
    console.log('Fonction get_user_trips non disponible, utilisation de la méthode classique');
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors du chargement des voyages:', error);
    }
    
    if (data) {
      setTrips(data);
    }
    setLoading(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleDeleteTrip = async (tripId: string, tripName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher l'ouverture du voyage
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le voyage "${tripName}" ?\n\nCette action est irréversible et supprimera toutes les données associées (étapes, participants, dépenses, etc.).`)) {
      return;
    }

    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId);

    if (error) {
      console.error('Erreur lors de la suppression du voyage:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
    } else {
      loadTrips();
    }
  };


  return (
    <div className="min-h-screen bg-cream font-body">
      <nav className="bg-white shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full overflow-x-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <img 
                src={logo} 
                alt="TravelU Logo" 
                className="w-10 h-10 object-contain flex-shrink-0"
              />
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-dark-gray break-words">TravelU</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-sm sm:text-base text-dark-gray font-body break-all sm:break-normal">{user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2.5 text-dark-gray hover:text-turquoise font-body font-medium transition-colors rounded-button text-sm sm:text-base whitespace-nowrap"
              >
                <LogOut className="w-5 h-5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-dark-gray break-words">Mes voyages</h2>
          <button
            onClick={() => setShowCreateTrip(true)}
            className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau voyage</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-dark-gray/70 font-body">Chargement...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-soft">
            <MapPin className="w-16 h-16 text-turquoise mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-dark-gray mb-2">
              Aucun voyage pour le moment
            </h3>
            <p className="text-dark-gray/70 font-body mb-6">
              Créez votre premier voyage pour commencer l'aventure
            </p>
            <button
              onClick={() => setShowCreateTrip(true)}
              className="px-6 py-3 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
            >
              Créer un voyage
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="bg-white rounded-2xl shadow-soft hover:shadow-medium transition-all cursor-pointer p-4 sm:p-6 transform hover:-translate-y-1 relative w-full overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="text-lg sm:text-xl font-heading font-semibold text-dark-gray flex-1 pr-2 break-words min-w-0">
                    {trip.name}
                  </h3>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`px-2 sm:px-3 py-1 text-xs font-heading font-semibold rounded-full whitespace-nowrap ${
                      trip.type === 'roadtrip'
                        ? 'bg-palm-green/20 text-palm-green'
                        : 'bg-turquoise/20 text-turquoise'
                    }`}>
                      {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteTrip(trip.id, trip.name, e)}
                      className="text-burnt-orange hover:text-burnt-orange/80 p-2 transition-colors rounded-button hover:bg-cream flex-shrink-0"
                      title="Supprimer ce voyage"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {trip.description && (
                  <p className="text-dark-gray/70 font-body text-sm mb-4 line-clamp-2 break-words">
                    {trip.description}
                  </p>
                )}
                <div className="flex items-center text-xs sm:text-sm text-dark-gray/60 font-body flex-wrap gap-1">
                  <MapPin className="w-4 h-4 text-turquoise flex-shrink-0" />
                  <span className="break-words">{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateTrip && (
        <CreateTripModal
          onClose={() => setShowCreateTrip(false)}
          onSuccess={() => {
            setShowCreateTrip(false);
            loadTrips();
          }}
        />
      )}
    </div>
  );
}

interface CreateTripModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTripModal({ onClose, onSuccess }: CreateTripModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<'single' | 'roadtrip'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Note: La destination n'est pas obligatoire, elle sert juste à pré-remplir le nom
    // Pour les voyages "single", l'utilisateur peut ajouter l'étape manuellement après

    if (new Date(endDate) < new Date(startDate)) {
      setError('La date de fin doit être après la date de début');
      return;
    }

    setLoading(true);

    // Vérifications préalables
    if (!user?.id) {
      setError('Erreur : utilisateur non connecté');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Le nom du voyage est requis');
      setLoading(false);
      return;
    }

    if (!startDate || !endDate) {
      setError('Les dates sont requises');
      setLoading(false);
      return;
    }

    console.log('Création du voyage avec les données:', {
      name,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      type,
      creator_id: user.id
    });

    // Utiliser la fonction PostgreSQL pour créer le voyage et éviter la récursion RLS
    // Si la fonction n'existe pas, on utilisera la méthode classique
    const { data: functionResult, error: functionError } = await supabase.rpc('create_trip_and_return_id', {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_start_date: startDate,
      p_end_date: endDate,
      p_type: type,
      p_creator_id: user.id
    });

    let tripId: string | null = null;

    if (functionError) {
      // Si la fonction n'existe pas, utiliser la méthode classique
      if (functionError.message?.includes('function') || functionError.message?.includes('does not exist')) {
        console.log('Fonction PostgreSQL non disponible, utilisation de la méthode classique');
        
        // Méthode alternative : insérer sans select, puis récupérer via une requête simple
        const { error: insertError } = await supabase
          .from('trips')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            start_date: startDate,
            end_date: endDate,
            type,
            creator_id: user.id
          });

        if (insertError) {
          console.error('Erreur lors de la création du voyage:', insertError);
          let errorMessage = 'Erreur lors de la création du voyage';
          
          if (insertError.code === '42P17' || insertError.message?.includes('infinite recursion')) {
            errorMessage = 'Erreur de récursion RLS. Veuillez exécuter les scripts de correction dans Supabase SQL Editor.';
          } else if (insertError.message) {
            errorMessage = `Erreur: ${insertError.message}`;
          }
          
          setError(errorMessage);
          setLoading(false);
          return;
        }

        // Attendre un peu pour que l'insertion soit complète
        await new Promise(resolve => setTimeout(resolve, 100));

        // Récupérer l'ID avec une requête simple qui ne devrait pas causer de récursion
        const { data: newTrip, error: fetchError } = await supabase
          .from('trips')
          .select('id')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError || !newTrip?.id) {
          console.error('Erreur lors de la récupération du voyage:', fetchError);
          setError('Le voyage a été créé mais n\'a pas pu être récupéré. Veuillez rafraîchir la page.');
          setLoading(false);
          return;
        }

        tripId = newTrip.id;

        // Ajouter le créateur comme participant
        const { error: participantError } = await supabase.from('trip_participants').insert({
          trip_id: tripId,
          user_id: user.id,
          permission: 'edit'
        });

        if (participantError) {
          console.error('Erreur lors de l\'ajout du participant:', participantError);
          setError('Le voyage a été créé mais l\'ajout en tant que participant a échoué');
          setLoading(false);
          return;
        }
      } else {
        setError(`Erreur: ${functionError.message}`);
        setLoading(false);
        return;
      }
    } else {
      // La fonction a fonctionné
      tripId = functionResult;
    }

    if (!tripId) {
      setError('Impossible de récupérer l\'ID du voyage créé');
      setLoading(false);
      return;
    }

      // Si une destination a été sélectionnée et que c'est un voyage "single", créer automatiquement l'étape
      if (selectedDestination && type === 'single') {
        console.log('Création de l\'étape pour destination unique:', selectedDestination);
        const { error: stageError } = await supabase.from('stages').insert({
          trip_id: tripId,
          name: selectedDestination.name,
          order_index: 1,
          latitude: selectedDestination.lat,
          longitude: selectedDestination.lon
        });

        if (stageError) {
          console.error('Erreur lors de la création de l\'étape:', {
            message: stageError.message,
            code: stageError.code,
            details: stageError.details,
            hint: stageError.hint
          });
          // On continue quand même, l'utilisateur pourra ajouter l'étape manuellement
          // Ne pas bloquer le succès de la création du voyage
        } else {
          console.log('Étape créée avec succès pour le voyage destination unique');
        }
      } else {
        console.log('Pas d\'étape créée automatiquement:', { selectedDestination: !!selectedDestination, type });
      }

    setLoading(false);
    onSuccess();
  };

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto smooth-scroll modal-content">
        <h2 className="text-2xl font-heading font-bold text-dark-gray mb-6">
          Créer un nouveau voyage
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-lg p-3 text-burnt-orange text-sm font-body">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2 font-body">
              Destination *
            </label>
            <CityAutocomplete
              value={destination}
              onChange={setDestination}
              onSelect={(city) => {
                setSelectedDestination(city);
                // Auto-remplir le nom du voyage si vide
                if (!name) {
                  setName(`Voyage à ${city.name}`);
                }
              }}
              placeholder="Rechercher une ville ou un pays..."
              required
            />
            {selectedDestination && (
              <p className="mt-1 text-xs text-dark-gray/60 font-body">
                📍 {selectedDestination.name} ({selectedDestination.lat.toFixed(4)}, {selectedDestination.lon.toFixed(4)})
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2 font-body">
              Nom du voyage *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
              placeholder="Ex: Voyage en Italie"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-2 font-body">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
              placeholder="Décrivez votre voyage..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2 font-body">
                Date de début *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2 font-body">
                Date de fin *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray mb-3 font-body">
              Type de voyage *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('single')}
                className={`p-4 border-2 rounded-button transition-all ${
                  type === 'single'
                    ? 'border-turquoise bg-turquoise/10 shadow-soft'
                    : 'border-cream hover:border-turquoise/50'
                }`}
              >
                <MapPin className={`w-6 h-6 mx-auto mb-2 ${type === 'single' ? 'text-turquoise' : 'text-dark-gray/60'}`} />
                <div className={`font-heading font-semibold ${type === 'single' ? 'text-turquoise' : 'text-dark-gray'}`}>Destination unique</div>
                <div className="text-sm text-dark-gray/70 mt-1 font-body">
                  Une seule ville ou lieu
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('roadtrip')}
                className={`p-4 border-2 rounded-button transition-all ${
                  type === 'roadtrip'
                    ? 'border-gold bg-gold/10 shadow-soft'
                    : 'border-cream hover:border-gold/50'
                }`}
              >
                <MapPin className={`w-6 h-6 mx-auto mb-2 ${type === 'roadtrip' ? 'text-gold' : 'text-dark-gray/60'}`} />
                <div className={`font-heading font-semibold ${type === 'roadtrip' ? 'text-gold' : 'text-dark-gray'}`}>Road trip</div>
                <div className="text-sm text-dark-gray/70 mt-1 font-body">
                  Plusieurs étapes
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-dark-gray hover:text-turquoise font-body font-medium transition-colors rounded-button"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none tracking-wide"
            >
              {loading ? 'Création...' : 'Créer le voyage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
