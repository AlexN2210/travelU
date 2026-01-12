import { useState, useEffect, useRef } from 'react';
import { MapPinned, Loader2, ExternalLink } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';

interface PointOfInterest {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
}

interface PointOfInterestAutocompleteProps {
  onSelect: (poi: { name: string; address: string; lat: number; lng: number; url: string }) => void;
  latitude?: number;
  longitude?: number;
  placeholder?: string;
}

export function PointOfInterestAutocomplete({
  onSelect,
  latitude,
  longitude,
  placeholder = "Rechercher un point d'intérêt (musée, parc, restaurant...)"
}: PointOfInterestAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: ['places']
  });

  // Initialiser les services Google Places
  useEffect(() => {
    if (isLoaded && typeof google !== 'undefined' && google.maps && google.maps.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // Créer un div invisible pour PlacesService (requis par l'API)
      const serviceDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(serviceDiv);
    }
  }, [isLoaded]);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Rechercher des points d'intérêt via Google Places Autocomplete Service
  const searchPOI = (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (!autocompleteServiceRef.current || !isLoaded) {
      console.error('Service Google Places non disponible');
      return;
    }

    setIsLoading(true);

    const request: google.maps.places.AutocompletionRequest = {
      input: searchQuery,
      types: ['establishment', 'point_of_interest'],
      language: 'fr'
    };

    // Ajouter un biais de localisation si disponible
    if (latitude && longitude) {
      request.location = new google.maps.LatLng(latitude, longitude);
      request.radius = 10000;
    }

    autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        // Récupérer les détails pour chaque prédiction
        const detailsPromises = predictions.slice(0, 8).map((prediction) => {
          return new Promise<PointOfInterest | null>((resolve) => {
            if (!placesServiceRef.current) {
              resolve(null);
              return;
            }

            const detailsRequest: google.maps.places.PlaceDetailsRequest = {
              placeId: prediction.place_id,
              fields: ['name', 'formatted_address', 'geometry', 'types']
            };

            placesServiceRef.current.getDetails(detailsRequest, (place, detailsStatus) => {
              if (detailsStatus === google.maps.places.PlacesServiceStatus.OK && place) {
                resolve({
                  place_id: place.place_id || prediction.place_id,
                  name: place.name || prediction.description,
                  formatted_address: place.formatted_address || prediction.description,
                  geometry: {
                    location: {
                      lat: place.geometry?.location?.lat() || 0,
                      lng: place.geometry?.location?.lng() || 0
                    }
                  },
                  types: place.types
                });
              } else {
                resolve(null);
              }
            });
          });
        });

        Promise.all(detailsPromises).then((details) => {
          const validDetails = details.filter((d): d is PointOfInterest => d !== null);
          setSuggestions(validDetails);
          setSelectedIndex(-1);
          setIsLoading(false);
        });
      } else {
        setSuggestions([]);
        setIsLoading(false);
      }
    });
  };

  // Debounce pour éviter trop de requêtes
  useEffect(() => {
    if (!isLoaded) return;

    const timeoutId = setTimeout(() => {
      if (query) {
        searchPOI(query);
      } else {
        setSuggestions([]);
      }
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [query, isLoaded, latitude, longitude]);

  const handleSelect = (poi: PointOfInterest) => {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name)}+${encodeURIComponent(poi.formatted_address)}&query_place_id=${poi.place_id}`;
    
    onSelect({
      name: poi.name,
      address: poi.formatted_address,
      lat: poi.geometry.location.lat,
      lng: poi.geometry.location.lng,
      url: googleMapsUrl
    });
    
    setQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const getTypeLabel = (types?: string[]) => {
    if (!types || types.length === 0) return '';
    
    const typeMap: { [key: string]: string } = {
      'museum': 'Musée',
      'park': 'Parc',
      'restaurant': 'Restaurant',
      'tourist_attraction': 'Attraction',
      'church': 'Église',
      'art_gallery': 'Galerie',
      'zoo': 'Zoo',
      'aquarium': 'Aquarium',
      'amusement_park': 'Parc d\'attractions',
      'library': 'Bibliothèque',
      'theater': 'Théâtre',
      'stadium': 'Stade',
      'shopping_mall': 'Centre commercial'
    };

    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }
    return '';
  };

  if (!isLoaded) {
    return (
      <div className="relative">
        <input
          type="text"
          disabled
          className="w-full px-4 py-2 pl-10 border border-cream rounded-button font-body opacity-50"
          placeholder="Chargement..."
        />
        <MapPinned className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 pl-10 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
          placeholder={placeholder}
        />
        <MapPinned className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-turquoise animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream max-h-64 overflow-y-auto smooth-scroll">
          {suggestions.map((poi, index) => {
            const typeLabel = getTypeLabel(poi.types);
            return (
              <button
                key={poi.place_id}
                type="button"
                onClick={() => handleSelect(poi)}
                className={`w-full text-left px-4 py-3 hover:bg-cream transition-colors border-b border-cream last:border-b-0 ${
                  index === selectedIndex ? 'bg-turquoise/10' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <MapPinned className="w-4 h-4 text-turquoise mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className="font-body font-medium text-dark-gray truncate">
                        {poi.name}
                      </div>
                      {typeLabel && (
                        <span className="text-xs bg-turquoise/20 text-turquoise px-2 py-0.5 rounded-full font-body">
                          {typeLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-dark-gray/60 font-body truncate mt-1">
                      {poi.formatted_address}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showSuggestions && !isLoading && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream p-4">
          <p className="text-sm text-dark-gray/60 font-body text-center">
            Aucun point d'intérêt trouvé pour "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
