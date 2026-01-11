import { useState, useEffect } from 'react';
import { Calendar, Plus, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TripView } from './TripView';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">TravelU</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">{user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
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
          <h2 className="text-3xl font-bold text-gray-900">Mes voyages</h2>
          <button
            onClick={() => setShowCreateTrip(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau voyage</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun voyage pour le moment
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre premier voyage pour commencer l'aventure
            </p>
            <button
              onClick={() => setShowCreateTrip(true)}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
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
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {trip.name}
                  </h3>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    trip.type === 'roadtrip'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {trip.type === 'roadtrip' ? 'Road trip' : 'Destination unique'}
                  </span>
                </div>
                {trip.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {trip.description}
                  </p>
                )}
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-2" />
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
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<'single' | 'roadtrip'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (new Date(endDate) < new Date(startDate)) {
      setError('La date de fin doit être après la date de début');
      return;
    }

    setLoading(true);

    const { data, error: insertError } = await supabase
      .from('trips')
      .insert({
        name,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        type,
        creator_id: user!.id
      })
      .select()
      .single();

    if (insertError) {
      setError('Erreur lors de la création du voyage');
      setLoading(false);
      return;
    }

    if (data) {
      await supabase.from('trip_participants').insert({
        trip_id: data.id,
        user_id: user!.id,
        permission: 'edit'
      });
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Créer un nouveau voyage
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du voyage *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Voyage en Italie"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Décrivez votre voyage..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de voyage *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('single')}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  type === 'single'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <MapPin className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">Destination unique</div>
                <div className="text-sm text-gray-600 mt-1">
                  Une seule ville ou lieu
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('roadtrip')}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  type === 'roadtrip'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="font-semibold">Road trip</div>
                <div className="text-sm text-gray-600 mt-1">
                  Plusieurs étapes
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le voyage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
