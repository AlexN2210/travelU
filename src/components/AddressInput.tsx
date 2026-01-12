import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/googleMapsConfig';

interface AddressInputProps {
  onSelect: (address: { address: string; lat: number; lng: number }) => void;
  onCancel: () => void;
  placeholder?: string;
}

export function AddressInput({ onSelect, onCancel, placeholder = "Entrez votre adresse..." }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!autocompleteServiceRef.current || !isLoaded) {
      console.error('Service Google Places non disponible');
      return;
    }

    setIsLoading(true);

    const request: google.maps.places.AutocompletionRequest = {
      input: searchQuery,
      types: ['address'],
      language: 'fr'
    };

    autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        setSuggestions(predictions.slice(0, 5));
      } else {
        setSuggestions([]);
      }
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!isLoaded) return;

    const timeoutId = setTimeout(() => {
      if (query) {
        searchAddress(query);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, isLoaded]);

  const handleSelectAddress = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    const detailsRequest: google.maps.places.PlaceDetailsRequest = {
      placeId: prediction.place_id,
      fields: ['geometry', 'formatted_address']
    };

    placesServiceRef.current.getDetails(detailsRequest, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry) {
        onSelect({
          address: prediction.description,
          lat: place.geometry.location?.lat() || 0,
          lng: place.geometry.location?.lng() || 0
        });
        setQuery('');
        setShowSuggestions(false);
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            disabled
            className="w-full px-4 py-2 pl-10 border border-cream rounded-button font-body opacity-50"
            placeholder="Chargement..."
          />
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2 bg-dark-gray/10 text-dark-gray rounded-button hover:bg-dark-gray/20 transition-colors text-sm"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="w-full px-4 py-2 pl-10 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body"
          placeholder={placeholder}
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-turquoise animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-white rounded-button shadow-medium border border-cream max-h-48 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectAddress(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-cream transition-colors border-b border-cream last:border-b-0"
            >
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-turquoise mt-0.5 flex-shrink-0" />
                <span className="text-sm text-dark-gray font-body">{suggestion.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="w-full px-4 py-2 bg-dark-gray/10 text-dark-gray rounded-button hover:bg-dark-gray/20 transition-colors text-sm"
      >
        Annuler
      </button>
    </div>
  );
}
