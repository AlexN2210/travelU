import { useState, useEffect } from 'react';
import { Plus, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TripView } from './TripView';
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
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

  if (selectedTripId) {
    return (
      <TripView
        tripId={selectedTripId}
        onBack={() => {
          setSelectedTripId(null);
          loadTrips();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cream font-body">
      <nav className="bg-white shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img 
                src={logo} 
                alt="TravelU Logo" 
                className="w-10 h-10 object-contain"
              />
              <h1 className="text-2xl font-heading font-bold text-dark-gray">TravelU</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-dark-gray font-body">{user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2.5 text-dark-gray hover:text-turquoise font-body font-medium transition-colors rounded-button"
              >
                <LogOut className="w-5 h-5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-heading font-bold text-dark-gray">Mes voyages</h2>
          <button
            onClick={() => setShowCreateTrip(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => setSelectedTripId(trip.id)}
                className="bg-white rounded-2xl shadow-soft hover:shadow-medium transition-all cursor-pointer p-6 transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-heading font-semibold text-dark-gray">
                    {trip.name}
                  </h3>
                  <span className={`px-3 py-1 text-xs font-heading font-semibold rounded-full ${
                    trip.type === 'roadtrip'
                      ? 'bg-palm-green/20 text-palm-green'
                      : 'bg-turquoise/20 text-turquoise'
                  }`}>
                    {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
                  </span>
                </div>
                {trip.description && (
                  <p className="text-dark-gray/70 font-body text-sm mb-4 line-clamp-2">
                    {trip.description}
                  </p>
                )}
                <div className="flex items-center text-sm text-dark-gray/60 font-body">
                  <MapPin className="w-4 h-4 mr-2 text-turquoise" />
                  {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
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

    // Insérer le voyage - on récupérera l'ID après avoir ajouté le participant
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
      console.error('Erreur complète lors de la création du voyage:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        error: insertError
      });
      
      let errorMessage = 'Erreur lors de la création du voyage';
      
      if (insertError.code === '42P17' || insertError.message?.includes('infinite recursion')) {
        errorMessage = 'Erreur de récursion dans les politiques RLS. Veuillez exécuter le script de correction dans Supabase SQL Editor (fichier: 20260112000000_fix_rls_recursion.sql)';
      } else if (insertError.code === 'PGRST301' || insertError.message?.includes('permission denied')) {
        errorMessage = 'Erreur de permissions. Vérifiez que les politiques RLS sont correctement configurées dans Supabase.';
      } else if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        errorMessage = 'La table "trips" n\'existe pas. Veuillez appliquer la migration SQL dans Supabase (SQL Editor).';
      } else if (insertError.message) {
        errorMessage = `Erreur: ${insertError.message}`;
        if (insertError.hint) {
          errorMessage += ` (${insertError.hint})`;
        }
      } else if (insertError.code) {
        errorMessage = `Erreur ${insertError.code}`;
      }
      
      setError(errorMessage);
      setLoading(false);
      return;
    }

    // Récupérer l'ID du voyage créé en faisant une requête séparée
    // On cherche le dernier voyage créé par cet utilisateur
    const { data: newTrip, error: fetchError } = await supabase
      .from('trips')
      .select('id')
      .eq('creator_id', user.id)
      .eq('name', name.trim())
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !newTrip) {
      console.error('Erreur lors de la récupération du voyage créé:', fetchError);
      setError('Le voyage a été créé mais n\'a pas pu être récupéré. Rafraîchissez la page.');
      setLoading(false);
      return;
    }

    const tripId = newTrip.id;

      // Ajouter le créateur comme participant avec permission d'édition
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

      // Si une destination a été sélectionnée et que c'est un voyage "single", créer automatiquement l'étape
      if (selectedDestination && type === 'single') {
        const { error: stageError } = await supabase.from('stages').insert({
          trip_id: tripId,
          name: selectedDestination.name,
          order_index: 1,
          latitude: selectedDestination.lat,
          longitude: selectedDestination.lon
        });

        if (stageError) {
          console.error('Erreur lors de la création de l\'étape:', stageError);
          // On continue quand même, l'utilisateur pourra ajouter l'étape manuellement
        }
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
