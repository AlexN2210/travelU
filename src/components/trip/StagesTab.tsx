import { useState, useEffect } from 'react';
import { Plus, MapPin, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CityAutocomplete } from '../CityAutocomplete';
import { StagesMapGoogle } from '../StagesMapGoogle';
import { AIActivitySuggestions } from '../AIActivitySuggestions';

interface PointOfInterest {
  title: string;
  url: string;
}

interface Stage {
  id: string;
  trip_id: string;
  name: string;
  order_index: number;
  latitude: number;
  longitude: number;
  accommodation_link: string | null;
  transport_to_next: string | null;
  notes: string | null;
  points_of_interest: PointOfInterest[] | null;
}

interface StagesTabProps {
  tripId: string;
  tripType: 'single' | 'roadtrip';
}

export function StagesTab({ tripId, tripType }: StagesTabProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStage, setShowAddStage] = useState(false);

  useEffect(() => {
    loadStages();
  }, [tripId]);

  const loadStages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .eq('trip_id', tripId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Erreur lors du chargement des étapes:', error);
    }
    
    if (data) {
      console.log('Étapes chargées:', data.length, data);
      setStages(data);
    } else {
      console.log('Aucune étape trouvée pour le voyage:', tripId);
    }
    setLoading(false);
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette étape ?')) return;

    const { error } = await supabase
      .from('stages')
      .delete()
      .eq('id', stageId);

    if (error) {
      console.error('Erreur lors de la suppression de l\'étape:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
    } else {
      loadStages();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-dark-gray">
          {tripType === 'roadtrip' ? 'Étapes du road trip' : 'Destination'}
        </h2>
        <button
          onClick={() => setShowAddStage(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gold text-white font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
        >
          <Plus className="w-5 h-5" />
          <span>{tripType === 'roadtrip' ? 'Ajouter une étape' : 'Ajouter/modifier la destination'}</span>
        </button>
      </div>

      {stages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <MapPin className="w-16 h-16 text-dark-gray/50 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-gray mb-2">
            Aucune étape pour le moment
          </h3>
          <p className="text-dark-gray/70 mb-6">
            Ajoutez votre première étape pour commencer à planifier
          </p>
          <button
            onClick={() => setShowAddStage(true)}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter une étape
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {stages.map((stage, index) => (
              <div key={stage.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gold to-turquoise text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-soft">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-dark-gray">
                        {stage.name}
                      </h3>
                      <p className="text-sm text-dark-gray/60">
                        {stage.latitude.toFixed(4)}, {stage.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    className="text-burnt-orange hover:text-burnt-orange/80 p-2 transition-colors rounded-button hover:bg-cream"
                    title="Supprimer cette étape"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {stage.accommodation_link && (
                  <div className="mb-3">
                    <p className="text-sm text-dark-gray/70 mb-1">Hébergement:</p>
                    <a
                      href={stage.accommodation_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-turquoise hover:text-turquoise/80 text-sm flex items-center space-x-1 font-body transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Voir l'hébergement</span>
                    </a>
                  </div>
                )}

                {stage.transport_to_next && (
                  <div className="mb-3">
                    <p className="text-sm text-dark-gray/70 mb-1">Transport vers la prochaine étape:</p>
                    <p className="text-sm text-dark-gray">{stage.transport_to_next}</p>
                  </div>
                )}

                {stage.points_of_interest && stage.points_of_interest.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-dark-gray/70 mb-2 font-semibold">Points d'intérêt:</p>
                    <div className="space-y-2">
                      {stage.points_of_interest.map((poi, poiIndex) => (
                        <a
                          key={poiIndex}
                          href={poi.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-turquoise hover:text-turquoise/80 text-sm flex items-center space-x-1 font-body transition-colors block"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>{poi.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {stage.notes && (
                  <div>
                    <p className="text-sm text-dark-gray/70 mb-1">Notes:</p>
                    <p className="text-sm text-dark-gray">{stage.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 h-fit sticky top-6">
            <h3 className="text-lg font-semibold text-dark-gray mb-4">Carte</h3>
            {stages.length > 0 ? (
              <StagesMapGoogle stages={stages} />
            ) : (
              <div className="bg-cream rounded-button h-96 flex items-center justify-center">
                <div className="text-center text-dark-gray/60 font-body">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune étape à afficher</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddStage && (
        <AddStageModal
          tripId={tripId}
          orderIndex={stages.length}
          onClose={() => setShowAddStage(false)}
          onSuccess={() => {
            setShowAddStage(false);
            loadStages();
          }}
        />
      )}
    </div>
  );
}

interface AddStageModalProps {
  tripId: string;
  orderIndex: number;
  onClose: () => void;
  onSuccess: () => void;
}

function AddStageModal({ tripId, orderIndex, onClose, onSuccess }: AddStageModalProps) {
  const [name, setName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [accommodationLink, setAccommodationLink] = useState('');
  const [transportToNext, setTransportToNext] = useState('');
  const [notes, setNotes] = useState('');
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [newPoiTitle, setNewPoiTitle] = useState('');
  const [newPoiUrl, setNewPoiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDestinationSelect = (city: { name: string; lat: number; lon: number; display_name: string }) => {
    console.log('Destination sélectionnée:', city);
    setSelectedDestination({ name: city.name, lat: city.lat, lon: city.lon });
    setName(city.name);
  };

  const handleAddPoi = () => {
    if (newPoiTitle.trim() && newPoiUrl.trim()) {
      // Vérifier que l'URL est valide
      try {
        new URL(newPoiUrl);
        setPointsOfInterest([...pointsOfInterest, { title: newPoiTitle.trim(), url: newPoiUrl.trim() }]);
        setNewPoiTitle('');
        setNewPoiUrl('');
      } catch {
        setError('URL invalide');
      }
    }
  };

  const handleRemovePoi = (index: number) => {
    setPointsOfInterest(pointsOfInterest.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedDestination) {
      setError('Veuillez sélectionner une destination');
      return;
    }

    if (!name.trim()) {
      setError('Le nom de l\'étape est requis');
      return;
    }

    setLoading(true);

    const { error: insertError } = await supabase
      .from('stages')
      .insert({
        trip_id: tripId,
        name: name.trim(),
        order_index: orderIndex,
        latitude: selectedDestination.lat,
        longitude: selectedDestination.lon,
        accommodation_link: accommodationLink || null,
        transport_to_next: transportToNext || null,
        notes: notes || null,
        points_of_interest: pointsOfInterest.length > 0 ? pointsOfInterest : null
      });

    if (insertError) {
      console.error('Erreur lors de l\'ajout de l\'étape:', insertError);
      setError(`Erreur lors de l'ajout de l'étape: ${insertError.message || 'Erreur inconnue'}`);
      setLoading(false);
      return;
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-medium max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto smooth-scroll modal-content">
        <h2 className="text-2xl font-bold text-dark-gray mb-6">
          Ajouter une étape
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-gray/80 mb-2">
              Destination *
            </label>
            <CityAutocomplete
              value={name}
              onChange={(value) => setName(value)}
              onSelect={handleDestinationSelect}
              placeholder="Rechercher une ville ou un pays..."
              className="w-full"
            />
            {selectedDestination && (
              <p className="mt-2 text-sm text-dark-gray/60 font-body">
                Coordonnées: {selectedDestination.lat.toFixed(4)}, {selectedDestination.lon.toFixed(4)}
              </p>
            )}
          </div>

          {selectedDestination ? (
            <div className="mt-2">
              <AIActivitySuggestions
                cityName={name || selectedDestination.name}
                latitude={selectedDestination.lat}
                longitude={selectedDestination.lon}
                onAddActivity={(activity) => {
                  setPointsOfInterest([...pointsOfInterest, activity]);
                }}
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-dark-gray/80 mb-2">
              Lien hébergement (optionnel)
            </label>
            <input
              type="url"
              value={accommodationLink}
              onChange={(e) => setAccommodationLink(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://airbnb.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray/80 mb-2">
              Transport vers la prochaine étape (optionnel)
            </label>
            <input
              type="text"
              value={transportToNext}
              onChange={(e) => setTransportToNext(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Train, Voiture, Avion..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray/80 mb-2">
              Points d'intérêt (musées, jardins, etc.) (optionnel)
            </label>
            <div className="space-y-2 mb-2">
              {pointsOfInterest.map((poi, index) => (
                <div key={index} className="flex items-center justify-between bg-cream rounded-lg p-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-gray">{poi.title}</p>
                    <a
                      href={poi.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-turquoise hover:text-turquoise/80 flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="text-xs truncate max-w-xs">{poi.url}</span>
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePoi(index)}
                    className="text-burnt-orange hover:text-burnt-orange/80 p-1 ml-2"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newPoiTitle}
                onChange={(e) => setNewPoiTitle(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Musée du Louvre"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPoi();
                  }
                }}
              />
              <input
                type="url"
                value={newPoiUrl}
                onChange={(e) => setNewPoiUrl(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPoi();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddPoi}
                className="px-4 py-2 bg-gold text-white font-semibold rounded-lg hover:bg-gold/90 transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-gray/80 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ajoutez des notes..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-dark-gray/80 hover:text-dark-gray font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
