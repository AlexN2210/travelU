import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface City {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (city: { name: string; lat: number; lon: number }) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher une ville ou un pays...",
  required = false,
  className = ""
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Rechercher des villes via l'API Nominatim
  const searchCities = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Utiliser Nominatim (OpenStreetMap) - API gratuite
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&extratags=1&accept-language=fr`,
        {
          headers: {
            'User-Agent': 'TravelU App'
          }
        }
      );
      
      const data: City[] = await response.json();
      
      // Filtrer pour obtenir principalement des villes/villages
      const filtered = data.filter((item: any) => {
        const address = item.address || {};
        // Inclure villes, villages, pays, régions
        return address.city || address.town || address.village || 
               address.country || address.state || address.region;
      });

      setSuggestions(filtered.slice(0, 8));
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Erreur lors de la recherche de villes:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce pour éviter trop de requêtes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value) {
        searchCities(value);
      } else {
        setSuggestions([]);
      }
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSelect = (city: City) => {
    const cityName = city.display_name.split(',')[0]; // Prendre juste le nom de la ville
    onChange(cityName);
    onSelect({
      name: cityName,
      lat: parseFloat(city.lat),
      lon: parseFloat(city.lon)
    });
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

  const formatSuggestion = (city: City) => {
    const parts = city.display_name.split(',');
    const mainName = parts[0];
    const location = parts.slice(1, 3).join(',').trim();
    return { mainName, location };
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={handleKeyDown}
          required={required}
          className={`w-full px-4 py-2 pl-10 border border-cream rounded-button focus:ring-2 focus:ring-turquoise focus:border-transparent font-body ${className}`}
          placeholder={placeholder}
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-turquoise animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream max-h-64 overflow-y-auto smooth-scroll">
          {suggestions.map((city, index) => {
            const { mainName, location } = formatSuggestion(city);
            return (
              <button
                key={city.place_id}
                type="button"
                onClick={() => handleSelect(city)}
                className={`w-full text-left px-4 py-3 hover:bg-cream transition-colors border-b border-cream last:border-b-0 ${
                  index === selectedIndex ? 'bg-turquoise/10' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-turquoise mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-medium text-dark-gray truncate">
                      {mainName}
                    </div>
                    {location && (
                      <div className="text-sm text-dark-gray/60 font-body truncate">
                        {location}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showSuggestions && !isLoading && value.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream p-4">
          <p className="text-sm text-dark-gray/60 font-body text-center">
            Aucune ville trouvée pour "{value}"
          </p>
        </div>
      )}
    </div>
  );
}
