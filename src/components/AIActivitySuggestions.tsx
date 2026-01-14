import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, ExternalLink, Plus } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/googleMapsConfig';

interface PointOfInterest {
  title: string;
  url: string;
  lat?: number;
  lng?: number;
}

interface AIActivitySuggestionsProps {
  cityName: string;
  latitude: number;
  longitude: number;
  onAddActivity: (activity: PointOfInterest) => void;
}

export function AIActivitySuggestions({ cityName, latitude, longitude, onAddActivity }: AIActivitySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<PointOfInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Initialiser le service Places
  useEffect(() => {
    if (isLoaded && typeof google !== 'undefined' && google.maps && google.maps.places) {
      const serviceDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(serviceDiv);
    }
  }, [isLoaded]);

  const fetchAISuggestions = async () => {
    setLoading(true);
    setError('');
    setShowSuggestions(true);

    if (!isLoaded || !placesServiceRef.current) {
      setError('Google Maps n\'est pas encore chargé. Veuillez réessayer dans quelques instants.');
      setLoading(false);
      return;
    }

    try {
      const activities: PointOfInterest[] = [];
      const seenPlaceIds = new Set<string>();

      // Utiliser Google Places Nearby Search pour trouver des activités
      const types = ['museum', 'park', 'tourist_attraction', 'art_gallery', 'zoo', 'aquarium', 'amusement_park', 'stadium', 'shopping_mall', 'restaurant', 'cafe'];
      
      // Faire des requêtes pour chaque type
      const searchPromises = types.slice(0, 5).map((type) => {
        return new Promise<void>((resolve) => {
          if (activities.length >= 5) {
            resolve();
            return;
          }

          const request: google.maps.places.PlaceSearchRequest = {
            location: new google.maps.LatLng(latitude, longitude),
            radius: 5000,
            type: type as google.maps.places.PlaceType,
            language: 'fr'
          };

          placesServiceRef.current!.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              for (const place of results.slice(0, 2)) {
                if (activities.length >= 5) break;
                if (!seenPlaceIds.has(place.place_id!)) {
                  seenPlaceIds.add(place.place_id!);
                  const placeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || '')}+${encodeURIComponent(cityName)}&query_place_id=${place.place_id}`;
                  activities.push({
                    title: place.name || 'Lieu d\'intérêt',
                    url: placeUrl,
                    lat: place.geometry?.location?.lat() || latitude,
                    lng: place.geometry?.location?.lng() || longitude
                  });
                }
              }
            }
            resolve();
          });
        });
      });

      await Promise.all(searchPromises);

      // Si on n'a pas assez de résultats, ajouter des suggestions génériques
      if (activities.length < 5) {
        const genericActivities = [
          { title: `Visiter ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
          { title: `Musées à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=musées+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
          { title: `Parcs à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=parcs+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
          { title: `Monuments à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=monuments+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
          { title: `Restaurants à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=restaurants+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
        ];

        for (const activity of genericActivities) {
          if (activities.length >= 5) break;
          if (!activities.some(a => a.title === activity.title)) {
            activities.push(activity);
          }
        }
      }

      setSuggestions(activities.slice(0, 5));
    } catch (err) {
      console.error('Erreur lors de la récupération des suggestions:', err);
      setError('Impossible de charger les suggestions. Veuillez réessayer.');
      
      // Suggestions de secours avec coordonnées de la ville
      setSuggestions([
        { title: `Visiter ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
        { title: `Musées à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=musées+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
        { title: `Parcs à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=parcs+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
        { title: `Monuments à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=monuments+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
        { title: `Restaurants à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=restaurants+${encodeURIComponent(cityName)}`, lat: latitude, lng: longitude },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={fetchAISuggestions}
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-gold to-turquoise text-white font-body font-bold rounded-button hover:opacity-90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed text-base"
        style={{ minHeight: '48px' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Recherche d'activités...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Suggestions d'activités par IA</span>
          </>
        )}
      </button>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
          {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-cream rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold text-dark-gray mb-2">Suggestions d'activités à {cityName}:</h4>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-soft">
              <div className="flex-1">
                <p className="text-sm font-medium text-dark-gray">{suggestion.title}</p>
                <a
                  href={suggestion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-turquoise hover:text-turquoise/80 flex items-center space-x-1 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate max-w-xs">Voir sur la carte</span>
                </a>
              </div>
              <button
                type="button"
                onClick={() => onAddActivity(suggestion)}
                className="ml-3 px-3 py-1.5 bg-gold text-white text-sm font-semibold rounded-button hover:bg-gold/90 transition-colors flex items-center space-x-1"
                title="Ajouter aux points d'intérêt"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
