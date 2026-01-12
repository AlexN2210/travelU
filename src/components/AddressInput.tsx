import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!apiKey) {
      console.error('Clé API Google Maps manquante');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&key=${apiKey}&types=address&language=fr`
      );
      const data = await response.json();

      if (data.predictions) {
        setSuggestions(data.predictions.slice(0, 5));
      }
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresse:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        searchAddress(query);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelectAddress = async (placeId: string, description: string) => {
    if (!apiKey) return;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=geometry,formatted_address`
      );
      const data = await response.json();

      if (data.result && data.result.geometry) {
        onSelect({
          address: description,
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng
        });
        setQuery('');
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des détails:', error);
    }
  };

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
              onClick={() => handleSelectAddress(suggestion.place_id, suggestion.description)}
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
