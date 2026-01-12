import { useState, useEffect } from 'react';
import { Plus, MapPin, Trash2, ExternalLink, Hotel, Car, MapPinned } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CityAutocomplete } from '../CityAutocomplete';
import { StagesMapGoogle } from '../StagesMapGoogle';
import { AIActivitySuggestions } from '../AIActivitySuggestions';
import { PointOfInterestAutocomplete } from '../PointOfInterestAutocomplete';
import { TransportRoute } from '../TransportRoute';
import { AddressInput } from '../AddressInput';

interface PointOfInterest {
  title: string;
  url: string;
  needsTransport?: boolean;
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
          tripType={tripType}
          orderIndex={stages.length}
          existingStage={tripType === 'single' && stages.length > 0 ? stages[0] : null}
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
  tripType: 'single' | 'roadtrip';
  orderIndex: number;
  existingStage?: Stage | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AddStageModal({ tripId, tripType, orderIndex, existingStage, onClose, onSuccess }: AddStageModalProps) {
  const [name, setName] = useState(existingStage?.name || '');
  const [selectedDestination, setSelectedDestination] = useState<{ name: string; lat: number; lon: number } | null>(
    existingStage ? {
      name: existingStage.name,
      lat: existingStage.latitude,
      lon: existingStage.longitude
    } : null
  );
  console.log('AddStageModal - selectedDestination:', selectedDestination);
  const [accommodationLink, setAccommodationLink] = useState(existingStage?.accommodation_link || '');
  const [transportToNext, setTransportToNext] = useState(existingStage?.transport_to_next || '');
  const [notes, setNotes] = useState(existingStage?.notes || '');
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [newPoiTitle, setNewPoiTitle] = useState('');
  const [newPoiUrl, setNewPoiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPoiSearch, setShowPoiSearch] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<{ name: string; url: string; lat: number; lng: number } | null>(null);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showAccommodationModal, setShowAccommodationModal] = useState(false);
  const [selectedPoiForTransport, setSelectedPoiForTransport] = useState<{ name: string; url: string; lat?: number; lng?: number } | null>(null);
  const [showTransportRoute, setShowTransportRoute] = useState(false);
  const [transportRouteDestination, setTransportRouteDestination] = useState<{ name: string; lat: number; lng: number; originLat?: number; originLng?: number; useGeolocation?: boolean } | null>(null);
  const [showAddressInput, setShowAddressInput] = useState(false);

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

    // Pour les voyages "single" avec étape existante, la destination est déjà définie
    if (!selectedDestination && !(tripType === 'single' && existingStage)) {
      setError('Veuillez sélectionner une destination');
      return;
    }

    if (!name.trim()) {
      setError('Le nom de l\'étape est requis');
      return;
    }

    setLoading(true);

    // Si une étape existe déjà, on la met à jour au lieu d'en créer une nouvelle
    if (existingStage) {
      const { error: updateError } = await supabase
        .from('stages')
        .update({
          name: name.trim(),
          latitude: selectedDestination?.lat || existingStage.latitude,
          longitude: selectedDestination?.lon || existingStage.longitude,
          accommodation_link: accommodationLink || null,
          transport_to_next: transportToNext || null,
          notes: notes || null,
          points_of_interest: pointsOfInterest.length > 0 ? pointsOfInterest : null
        })
        .eq('id', existingStage.id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour de l\'étape:', updateError);
        setError(`Erreur lors de la mise à jour de l'étape: ${updateError.message || 'Erreur inconnue'}`);
        setLoading(false);
        return;
      }
    } else {
      // Créer une nouvelle étape
      if (!selectedDestination) {
        setError('Veuillez sélectionner une destination');
        setLoading(false);
        return;
      }

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

          {/* Champ de destination - masqué pour les voyages "single" avec étape existante */}
          {!(tripType === 'single' && existingStage) && (
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
          )}

          {/* Affichage de la destination pour les voyages "single" avec étape existante */}
          {tripType === 'single' && existingStage && selectedDestination && (
            <div className="bg-cream rounded-lg p-4">
              <label className="block text-sm font-medium text-dark-gray/80 mb-2">
                Destination
              </label>
              <p className="font-semibold text-dark-gray">{selectedDestination.name}</p>
              <p className="mt-1 text-sm text-dark-gray/60 font-body">
                Coordonnées: {selectedDestination.lat.toFixed(4)}, {selectedDestination.lon.toFixed(4)}
              </p>
            </div>
          )}

          {selectedDestination && (
            <div className="mt-4">
              <AIActivitySuggestions
                cityName={name || selectedDestination.name}
                latitude={selectedDestination.lat}
                longitude={selectedDestination.lon}
                onAddActivity={(activity) => {
                  setPointsOfInterest([...pointsOfInterest, activity]);
                }}
              />
            </div>
          )}
          

          {/* Bouton Points d'intérêt */}
          {!showPoiSearch && !selectedPoi && (
            <button
              type="button"
              onClick={() => setShowPoiSearch(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white border-2 border-turquoise rounded-button hover:bg-turquoise/10 transition-all shadow-soft hover:shadow-medium mt-4"
            >
              <MapPinned className="w-5 h-5 text-turquoise" />
              <span className="font-body font-semibold text-dark-gray">
                Points d'intérêt {pointsOfInterest.length > 0 && `(${pointsOfInterest.length})`}
              </span>
            </button>
          )}

          {/* Champ de recherche Points d'intérêt */}
          {showPoiSearch && !selectedPoi && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-dark-gray/80">
                  Rechercher un point d'intérêt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowPoiSearch(false);
                  }}
                  className="text-dark-gray/60 hover:text-dark-gray text-sm"
                >
                  Annuler
                </button>
              </div>
              <PointOfInterestAutocomplete
                onSelect={(poi) => {
                  setSelectedPoi({
                    name: poi.name,
                    url: poi.url,
                    lat: poi.lat,
                    lng: poi.lng
                  });
                  setShowPoiSearch(false);
                }}
                latitude={selectedDestination?.lat}
                longitude={selectedDestination?.lon}
                placeholder="Rechercher un musée, parc, restaurant..."
              />
            </div>
          )}

          {/* Bouton Transport après sélection d'un POI */}
          {selectedPoi && (
            <div className="mt-4 space-y-3">
              <div className="bg-cream rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-dark-gray">{selectedPoi.name}</p>
                  <p className="text-sm text-dark-gray/70">Point d'intérêt sélectionné</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPoi(null);
                    setShowPoiSearch(false);
                  }}
                  className="text-burnt-orange hover:text-burnt-orange/80"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setSelectedPoiForTransport(selectedPoi)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-turquoise text-white rounded-button hover:bg-turquoise/90 transition-colors font-semibold"
              >
                <Car className="w-5 h-5" />
                <span>Voulez-vous connaître le transport pour vous y rendre ?</span>
              </button>
            </div>
          )}


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


      {/* Modal choix transport pour le point d'intérêt */}
      {selectedPoiForTransport && !showAddressInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm" onClick={() => {
          setSelectedPoiForTransport(null);
          setSelectedPoi(null);
        }}>
          <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-dark-gray">Transport vers {selectedPoiForTransport.name}</h3>
              <button onClick={() => {
                setSelectedPoiForTransport(null);
                setSelectedPoi(null);
              }} className="text-dark-gray/60 hover:text-dark-gray">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-cream rounded-lg p-4">
                <p className="font-semibold text-dark-gray mb-2">{selectedPoiForTransport.name}</p>
                <p className="text-sm text-dark-gray/70 font-body">Comment voulez-vous calculer l'itinéraire ?</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (selectedPoiForTransport.lat && selectedPoiForTransport.lng) {
                      // Utiliser la géolocalisation
                      setUseGeolocation(true);
                      setTransportRouteDestination({
                        name: selectedPoiForTransport.name,
                        lat: selectedPoiForTransport.lat,
                        lng: selectedPoiForTransport.lng
                      });
                      setShowTransportRoute(true);
                      setSelectedPoiForTransport(null);
                    }
                  }}
                  className="w-full px-4 py-3 bg-turquoise text-white rounded-button hover:bg-turquoise/90 transition-colors font-semibold flex items-center justify-center space-x-2"
                >
                  <MapPin className="w-5 h-5" />
                  <span>Géolocalisation (position actuelle)</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddressInput(true);
                  }}
                  className="w-full px-4 py-3 bg-gold text-white rounded-button hover:bg-gold/90 transition-colors font-semibold flex items-center justify-center space-x-2"
                >
                  <MapPin className="w-5 h-5" />
                  <span>Adresse précise</span>
                </button>
                <button
                  onClick={() => {
                    // Ajouter sans transport
                    setPointsOfInterest([...pointsOfInterest, {
                      title: selectedPoiForTransport.name,
                      url: selectedPoiForTransport.url,
                      needsTransport: false
                    }]);
                    setSelectedPoi(null);
                    setSelectedPoiForTransport(null);
                  }}
                  className="w-full px-4 py-3 bg-dark-gray/10 text-dark-gray rounded-button hover:bg-dark-gray/20 transition-colors font-semibold"
                >
                  Non, sans transport
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal saisie d'adresse */}
      {showAddressInput && selectedPoiForTransport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm" onClick={() => {
          setShowAddressInput(false);
          setSelectedPoiForTransport(null);
        }}>
          <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-dark-gray">Adresse de départ</h3>
              <button onClick={() => {
                setShowAddressInput(false);
                setSelectedPoiForTransport(null);
              }} className="text-dark-gray/60 hover:text-dark-gray">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-cream rounded-lg p-4 mb-4">
                <p className="text-sm text-dark-gray/70 font-body">
                  <strong>Destination:</strong> {selectedPoiForTransport.name}
                </p>
              </div>
              <AddressInput
                onSelect={(address) => {
                  if (selectedPoiForTransport.lat && selectedPoiForTransport.lng) {
                    setTransportRouteDestination({
                      name: selectedPoiForTransport.name,
                      lat: selectedPoiForTransport.lat,
                      lng: selectedPoiForTransport.lng,
                      originLat: address.lat,
                      originLng: address.lng,
                      useGeolocation: false
                    });
                    setShowTransportRoute(true);
                    setShowAddressInput(false);
                    setSelectedPoiForTransport(null);
                  }
                }}
                onCancel={() => {
                  setShowAddressInput(false);
                }}
                placeholder="Entrez votre adresse de départ..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Transport */}
      {showTransportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm" onClick={() => setShowTransportModal(false)}>
          <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-dark-gray">Transport vers la prochaine étape</h3>
              <button onClick={() => setShowTransportModal(false)} className="text-dark-gray/60 hover:text-dark-gray">✕</button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={transportToNext}
                onChange={(e) => setTransportToNext(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent"
                placeholder="Ex: Train, Voiture, Avion..."
              />
              <div className="flex justify-end">
                <button
                  onClick={() => setShowTransportModal(false)}
                  className="px-4 py-2 bg-dark-gray text-white rounded-button hover:bg-dark-gray/90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Itinéraire Transport */}
      {showTransportRoute && transportRouteDestination && (
        <TransportRoute
          destinationLat={transportRouteDestination.lat}
          destinationLng={transportRouteDestination.lng}
          destinationName={transportRouteDestination.name}
          originLat={transportRouteDestination.originLat}
          originLng={transportRouteDestination.originLng}
          useGeolocation={transportRouteDestination.useGeolocation}
          onClose={() => {
            setShowTransportRoute(false);
            // Ajouter le point d'intérêt après avoir vu l'itinéraire
            setPointsOfInterest([...pointsOfInterest, {
              title: transportRouteDestination.name,
              url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(transportRouteDestination.name)}`,
              needsTransport: true
            }]);
            setSelectedPoi(null);
            setTransportRouteDestination(null);
          }}
        />
      )}

      {/* Modal Hébergement */}
      {showAccommodationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm" onClick={() => setShowAccommodationModal(false)}>
          <div className="bg-white rounded-2xl shadow-medium max-w-md w-full p-6 modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-dark-gray">Lien hébergement</h3>
              <button onClick={() => setShowAccommodationModal(false)} className="text-dark-gray/60 hover:text-dark-gray">✕</button>
            </div>
            <div className="space-y-4">
              <input
                type="url"
                value={accommodationLink}
                onChange={(e) => setAccommodationLink(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palm-green focus:border-transparent"
                placeholder="https://airbnb.com/..."
              />
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAccommodationModal(false)}
                  className="px-4 py-2 bg-dark-gray text-white rounded-button hover:bg-dark-gray/90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
