import { useEffect, useRef, useState } from 'react';
import { MapPinned, Loader2 } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/googleMapsConfig';

type VotePlaceMode = 'restaurant' | 'activity';

interface VotePlacesAutocompleteProps {
  mode: VotePlaceMode;
  latitude?: number;
  longitude?: number;
  placeholder?: string;
  onSelect: (place: {
    name: string;
    address: string;
    url: string;
    imageUrl?: string | null;
    types?: string[];
  }) => void;
}

export function VotePlacesAutocomplete({
  mode,
  latitude,
  longitude,
  placeholder,
  onSelect
}: VotePlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  useEffect(() => {
    if (isLoaded && typeof google !== 'undefined' && google.maps?.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
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

  const allowedTypes =
    mode === 'restaurant'
      ? new Set(['restaurant', 'bar', 'cafe'])
      : new Set(['tourist_attraction', 'museum', 'park', 'art_gallery', 'amusement_park', 'zoo', 'aquarium']);

  const maxDistanceKm = mode === 'restaurant' ? 80 : 200;

  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  };

  const doSearch = (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (!autocompleteServiceRef.current || !placesServiceRef.current || !isLoaded) return;

    setIsLoading(true);

    const baseRequest = {
      input: searchQuery,
      language: 'fr' as const
    };

    let locationBias: google.maps.Circle | undefined;
    if (latitude && longitude) {
      const location = new google.maps.LatLng(latitude, longitude);
      // biais plus large pour éviter les résultats globaux
      locationBias = new google.maps.Circle({ center: location, radius: 50000 });
    }

    // On récupère large (establishment + point_of_interest) puis on filtre par types réels via getDetails
    const request1: google.maps.places.AutocompletionRequest = {
      ...baseRequest,
      types: ['establishment'],
      ...(locationBias && { locationBias })
    };
    const request2: google.maps.places.AutocompletionRequest = {
      ...baseRequest,
      types: ['point_of_interest'],
      ...(locationBias && { locationBias })
    };

    const all: google.maps.places.AutocompletePrediction[] = [];
    let done = 0;

    const finish = () => {
      const unique = Array.from(new Map(all.map(p => [p.place_id, p])).values()).slice(0, 10);
      const promises = unique.map(
        (prediction) =>
          new Promise<any | null>((resolve) => {
            const detailsRequest: google.maps.places.PlaceDetailsRequest = {
              placeId: prediction.place_id,
              fields: ['name', 'formatted_address', 'types', 'photos', 'place_id', 'geometry']
            };
            placesServiceRef.current!.getDetails(detailsRequest, (place, status) => {
              if (status !== google.maps.places.PlacesServiceStatus.OK || !place) return resolve(null);

              const types = place.types || [];
              const ok = types.some(t => allowedTypes.has(t));
              if (!ok) return resolve(null);

              // Filtre distance pour éviter des suggestions à l'étranger (ex: USA) quand on connaît la destination
              if (latitude && longitude && place.geometry?.location) {
                const dist = haversineKm(
                  { lat: latitude, lng: longitude },
                  { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
                );
                if (dist > maxDistanceKm) return resolve(null);
              }

              const imageUrl =
                place.photos && place.photos.length > 0
                  ? place.photos[0].getUrl({ maxWidth: 1000, maxHeight: 600 })
                  : null;

              resolve({
                place_id: place.place_id || prediction.place_id,
                name: place.name || prediction.description,
                address: place.formatted_address || prediction.description,
                types,
                imageUrl
              });
            });
          })
      );

      Promise.all(promises).then((items) => {
        const filtered = items.filter(Boolean).slice(0, 8);
        setSuggestions(filtered);
        setIsLoading(false);
      });
    };

    const handlePredictions = (predictions: google.maps.places.AutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        all.push(...predictions);
      }
      done++;
      if (done === 2) finish();
    };

    autocompleteServiceRef.current.getPlacePredictions(request1, handlePredictions);
    autocompleteServiceRef.current.getPlacePredictions(request2, handlePredictions);
  };

  useEffect(() => {
    if (!isLoaded) return;
    const t = window.setTimeout(() => {
      if (query) doSearch(query);
      else setSuggestions([]);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, isLoaded, latitude, longitude, mode]);

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

  const ph =
    placeholder ||
    (mode === 'restaurant'
      ? 'Rechercher un restaurant, bar ou café...'
      : 'Rechercher une activité (musée, parc, attraction...)...');

  return (
    <div ref={wrapperRef} className="relative">
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
          placeholder={ph}
        />
        <MapPinned className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-gray/40" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-turquoise animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream max-h-64 overflow-y-auto smooth-scroll">
          {suggestions.map((s: any) => (
            <button
              key={s.place_id}
              type="button"
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}&query_place_id=${s.place_id}`;
                onSelect({
                  name: s.name,
                  address: s.address,
                  url,
                  imageUrl: s.imageUrl,
                  types: s.types
                });
                setQuery('');
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-cream transition-colors border-b border-cream last:border-b-0"
            >
              <div className="font-body font-medium text-dark-gray">{s.name}</div>
              <div className="text-sm text-dark-gray/60 font-body truncate">{s.address}</div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && !isLoading && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-button shadow-medium border border-cream p-4">
          <p className="text-sm text-dark-gray/60 font-body text-center">
            Aucun résultat pour "{query}"
          </p>
        </div>
      )}
    </div>
  );
}

