import { useState } from 'react';
import { Sparkles, Loader2, ExternalLink, Plus } from 'lucide-react';

interface PointOfInterest {
  title: string;
  url: string;
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

  const fetchAISuggestions = async () => {
    setLoading(true);
    setError('');
    setShowSuggestions(true);

    try {
      // Utiliser l'API Nominatim pour obtenir des informations sur la ville
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TravelU App'
          }
        }
      );
      
      const nominatimData = await nominatimResponse.json();
      const locationInfo = nominatimData.address || {};
      const fullCityName = locationInfo.city || locationInfo.town || locationInfo.village || cityName;
      const country = locationInfo.country || '';

      // Utiliser une API de recherche de lieux d'intérêt (Overpass API d'OpenStreetMap)
      // Chercher des musées, parcs, monuments, etc.
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"="museum"](around:5000,${latitude},${longitude});
          node["leisure"="park"](around:5000,${latitude},${longitude});
          node["historic"="monument"](around:5000,${latitude},${longitude});
          node["amenity"="theatre"](around:5000,${latitude},${longitude});
          node["tourism"="attraction"](around:5000,${latitude},${longitude});
        );
        out body;
        >;
        out skel qt;
      `;

      const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      const overpassData = await overpassResponse.json();
      
      // Traiter les résultats et créer des suggestions
      const activities: PointOfInterest[] = [];
      const seenNames = new Set<string>();

      if (overpassData.elements) {
        for (const element of overpassData.elements.slice(0, 10)) {
          const name = element.tags?.name;
          if (name && !seenNames.has(name)) {
            seenNames.add(name);
            
            // Créer un lien vers OpenStreetMap ou Google Maps
            const osmUrl = `https://www.openstreetmap.org/node/${element.id}`;
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}+${encodeURIComponent(fullCityName)}`;
            
            // Déterminer le type d'activité
            let activityType = 'Lieu d\'intérêt';
            if (element.tags?.tourism === 'museum') activityType = 'Musée';
            else if (element.tags?.leisure === 'park') activityType = 'Parc';
            else if (element.tags?.historic) activityType = 'Monument';
            else if (element.tags?.amenity === 'theatre') activityType = 'Théâtre';
            
            activities.push({
              title: `${activityType}: ${name}`,
              url: googleMapsUrl
            });

            if (activities.length >= 5) break;
          }
        }
      }

      // Si on n'a pas assez de résultats, ajouter des suggestions génériques basées sur la ville
      if (activities.length < 5) {
        const genericActivities = [
          { title: `Visiter ${fullCityName}`, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullCityName)}` },
          { title: `Musées à ${fullCityName}`, url: `https://www.google.com/maps/search/?api=1&query=musées+${encodeURIComponent(fullCityName)}` },
          { title: `Parcs à ${fullCityName}`, url: `https://www.google.com/maps/search/?api=1&query=parcs+${encodeURIComponent(fullCityName)}` },
          { title: `Monuments à ${fullCityName}`, url: `https://www.google.com/maps/search/?api=1&query=monuments+${encodeURIComponent(fullCityName)}` },
          { title: `Restaurants à ${fullCityName}`, url: `https://www.google.com/maps/search/?api=1&query=restaurants+${encodeURIComponent(fullCityName)}` },
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
      
      // Suggestions de secours
      setSuggestions([
        { title: `Visiter ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityName)}` },
        { title: `Musées à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=musées+${encodeURIComponent(cityName)}` },
        { title: `Parcs à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=parcs+${encodeURIComponent(cityName)}` },
        { title: `Monuments à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=monuments+${encodeURIComponent(cityName)}` },
        { title: `Restaurants à ${cityName}`, url: `https://www.google.com/maps/search/?api=1&query=restaurants+${encodeURIComponent(cityName)}` },
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
        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-gold to-turquoise text-white font-body font-bold rounded-button hover:opacity-90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
