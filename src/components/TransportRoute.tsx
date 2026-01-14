import { useState, useEffect } from 'react';
import { MapPin, Car, Train, Bike, Footprints, Loader2, ExternalLink } from 'lucide-react';

interface TransportRouteProps {
  destinationLat: number;
  destinationLng: number;
  destinationName: string;
  originLat?: number;
  originLng?: number;
  useGeolocation?: boolean;
  onClose: () => void;
}

interface RouteOption {
  mode: string;
  duration: string;
  distance: string;
  steps: string[];
  url: string;
}

export function TransportRoute({ destinationLat, destinationLng, destinationName, originLat, originLng, useGeolocation = true, onClose }: TransportRouteProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>('');

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (useGeolocation) {
      getCurrentLocation();
    } else if (originLat && originLng) {
      calculateRoutes(originLat, originLng);
    } else {
      setError('Coordonnées de départ manquantes');
      setLoading(false);
    }
  }, [useGeolocation, originLat, originLng]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur');
      setLoading(false);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        calculateRoutes(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.error('Erreur de géolocalisation:', err);
        setError('Impossible d\'obtenir votre position. Vérifiez que la géolocalisation est activée.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const calculateRoutes = async (originLat: number, originLng: number) => {
    if (!apiKey) {
      setError('Clé API Google Maps manquante');
      setLoading(false);
      return;
    }

    try {
      const modes = [
        { mode: 'driving', label: 'Voiture', icon: Car },
        { mode: 'transit', label: 'Transports en commun', icon: Train },
        { mode: 'walking', label: 'Marche', icon: Footprints },
        { mode: 'bicycling', label: 'Vélo', icon: Bike }
      ];

      const routesPromises = modes.map(async ({ mode, label }) => {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&mode=${mode}&key=${apiKey}&language=fr&alternatives=false`
          );
          const data = await response.json();

          if (data.status === 'OK' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs[0];
            
            // Extraire les étapes principales
            const steps = route.legs[0].steps.slice(0, 5).map((step: any) => {
              return step.html_instructions.replace(/<[^>]*>/g, '').substring(0, 100);
            });

            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=${mode}`;

            return {
              mode: label,
              duration: leg.duration.text,
              distance: leg.distance.text,
              steps: steps,
              url: googleMapsUrl
            };
          }
          return null;
        } catch (err) {
          console.error(`Erreur pour le mode ${mode}:`, err);
          return null;
        }
      });

      const results = await Promise.all(routesPromises);
      const validRoutes = results.filter((r): r is RouteOption => r !== null);
      
      // Trier par durée (convertir en secondes pour comparer)
      validRoutes.sort((a, b) => {
        const aSeconds = parseDurationToSeconds(a.duration);
        const bSeconds = parseDurationToSeconds(b.duration);
        return aSeconds - bSeconds;
      });

      setRoutes(validRoutes);
      if (validRoutes.length > 0) {
        setSelectedMode(validRoutes[0].mode);
      }
    } catch (err) {
      console.error('Erreur lors du calcul des itinéraires:', err);
      setError('Impossible de calculer les itinéraires');
    } finally {
      setLoading(false);
    }
  };

  const parseDurationToSeconds = (duration: string): number => {
    // Convertir "1 h 30 min" ou "45 min" en secondes
    const hoursMatch = duration.match(/(\d+)\s*h/);
    const minutesMatch = duration.match(/(\d+)\s*min/);
    
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    
    return hours * 3600 + minutes * 60;
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'Voiture':
        return Car;
      case 'Transports en commun':
        return Train;
      case 'Marche':
        return Footprints;
      case 'Vélo':
        return Bike;
      default:
        return MapPin;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'Voiture':
        return 'bg-gold/20 text-gold';
      case 'Transports en commun':
        return 'bg-turquoise/20 text-turquoise';
      case 'Marche':
        return 'bg-palm-green/20 text-palm-green';
      case 'Vélo':
        return 'bg-burnt-orange/20 text-burnt-orange';
      default:
        return 'bg-dark-gray/20 text-dark-gray';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-medium max-w-2xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto smooth-scroll modal-content mx-4 sm:mx-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-dark-gray">Itinéraire vers {destinationName}</h3>
          <button onClick={onClose} className="text-dark-gray/60 hover:text-dark-gray">✕</button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-turquoise animate-spin mb-4" />
            <p className="text-dark-gray/70 font-body">Calcul des itinéraires en cours...</p>
            <p className="text-sm text-dark-gray/50 mt-2">Autorisez la géolocalisation si demandé</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm font-body">{error}</p>
            <button
              onClick={getCurrentLocation}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-button hover:bg-red-700 transition-colors text-sm"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && routes.length > 0 && (
          <div className="space-y-4">
            <div className="bg-cream rounded-lg p-4">
              <p className="text-sm text-dark-gray/70 font-body mb-2">
                <strong>Destination:</strong> {destinationName}
              </p>
              {userLocation && (
                <p className="text-sm text-dark-gray/70 font-body">
                  <strong>Départ:</strong> Votre position actuelle
                </p>
              )}
            </div>

            <div className="space-y-3">
              {routes.map((route, index) => {
                const Icon = getModeIcon(route.mode);
                const isSelected = selectedMode === route.mode;
                const isFastest = index === 0;

                return (
                  <div
                    key={route.mode}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-turquoise bg-turquoise/5'
                        : 'border-cream hover:border-turquoise/50'
                    }`}
                    onClick={() => setSelectedMode(route.mode)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`p-2 rounded-lg ${getModeColor(route.mode)}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-dark-gray">{route.mode}</h4>
                            {isFastest && (
                              <span className="text-xs bg-gold text-white px-2 py-0.5 rounded-full font-body">
                                Le plus rapide
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-dark-gray/70 font-body">
                            <span>⏱️ {route.duration}</span>
                            <span>📏 {route.distance}</span>
                          </div>
                          {isSelected && route.steps.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-xs font-semibold text-dark-gray/80 mb-1">Itinéraire:</p>
                              {route.steps.map((step, stepIndex) => (
                                <p key={stepIndex} className="text-xs text-dark-gray/60 font-body">
                                  {stepIndex + 1}. {step}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <a
                        href={route.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-3 p-2 text-turquoise hover:bg-turquoise/10 rounded-lg transition-colors"
                        title="Ouvrir dans Google Maps"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 border-t border-cream">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-dark-gray text-white rounded-button hover:bg-dark-gray/90 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {!loading && !error && routes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-gray/70 font-body">Aucun itinéraire trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
