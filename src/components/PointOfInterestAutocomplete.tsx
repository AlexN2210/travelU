import { useState, useEffect, useRef } from 'react';
import { MapPinned, Loader2, ExternalLink } from 'lucide-react';

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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  // Rechercher des points d'intérêt via Google Places API
  const searchPOI = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (!apiKey) {
      console.error('Clé API Google Maps manquante');
      return;
    }

    setIsLoading(true);
    try {
      // Utiliser Google Places Autocomplete API
      const locationBias = latitude && longitude 
        ? `&location=${latitude},${longitude}&radius=10000`
        : '';
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&key=${apiKey}&types=establishment|point_of_interest${locationBias}&language=fr`
      );
      
      const data = await response.json();
      
      if (data.predictions) {
        // Récupérer les détails pour chaque prédiction
        const detailsPromises = data.predictions.slice(0, 8).map(async (prediction: any) => {
          const detailsResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${apiKey}&fields=name,formatted_address,geometry,types&language=fr`
          );
          const detailsData = await detailsResponse.json();
          return detailsData.result;
        });

        const details = await Promise.all(detailsPromises);
        setSuggestions(details.filter((d: any) => d !== undefined));
        setSelectedIndex(-1);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de points d\'intérêt:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce pour éviter trop de requêtes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        searchPOI(query);
      } else {
        setSuggestions([]);
      }
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [query]);

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
