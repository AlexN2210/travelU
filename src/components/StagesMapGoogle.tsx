import { useEffect, useState, useMemo } from 'react';
import { GoogleMap, useLoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

interface PointOfInterest {
  title: string;
  url: string;
  needsTransport?: boolean;
  lat?: number;
  lng?: number;
}

interface Stage {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes?: string | null;
  points_of_interest?: PointOfInterest[] | null;
}

interface StagesMapGoogleProps {
  stages: Stage[];
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

import { GOOGLE_MAPS_LIBRARIES } from '../lib/googleMapsConfig';

const libraries = GOOGLE_MAPS_LIBRARIES;

export function StagesMapGoogle({ stages }: StagesMapGoogleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: libraries
  });

  // Filtrer les étapes valides avec useMemo (AVANT les retours conditionnels)
  const validStages = useMemo(() => {
    return stages.filter(stage => 
      typeof stage.latitude === 'number' && 
      typeof stage.longitude === 'number' &&
      !isNaN(stage.latitude) && 
      !isNaN(stage.longitude)
    );
  }, [stages]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || stages.length === 0) {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <div className="w-8 h-8 border-4 border-turquoise border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  const firstStage = validStages[0];
  if (!firstStage || typeof firstStage.latitude !== 'number' || typeof firstStage.longitude !== 'number') {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <p>Coordonnées invalides</p>
        </div>
      </div>
    );
  }

  const center = {
    lat: firstStage.latitude,
    lng: firstStage.longitude
  };

  const zoom = stages.length === 1 ? 12 : stages.length === 2 ? 8 : 6;

  const onLoad = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    if (validStages.length > 1 && typeof google !== 'undefined' && google.maps) {
      const bounds = new google.maps.LatLngBounds();
      validStages.forEach(stage => {
        bounds.extend(new google.maps.LatLng(stage.latitude, stage.longitude));
      });
      mapInstance.fitBounds(bounds);
    }
  };

  if (!apiKey) {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <p className="text-red-600 font-semibold">Clé API Google Maps manquante</p>
          <p className="text-sm mt-2 text-dark-gray/70">Veuillez ajouter VITE_GOOGLE_MAPS_API_KEY dans votre fichier .env</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <p className="text-red-600 font-semibold">Erreur lors du chargement de Google Maps</p>
          <p className="text-sm mt-2 text-dark-gray/70">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <div className="w-8 h-8 border-4 border-turquoise border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-button overflow-hidden" style={{ height: '384px' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        options={{
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }]
            }
          ],
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true
        }}
      >
        {validStages.map((stage, index) => {
          // Créer une icône personnalisée avec un dégradé doré/turquoise
          const iconUrl = `data:image/svg+xml;base64,${btoa(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#FFC857;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#00B4D8;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="14" fill="url(#grad${index})" stroke="white" stroke-width="3"/>
              <text x="16" y="20" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${index + 1}</text>
            </svg>
          `)}`;

          return (
            <Marker
              key={`marker-${stage.id}-${index}`}
              position={{ lat: stage.latitude, lng: stage.longitude }}
              icon={{
                url: iconUrl,
                scaledSize: new google.maps.Size(32, 32),
                anchor: new google.maps.Point(16, 16)
              }}
              onClick={() => setSelectedStage(stage)}
            >
              {selectedStage?.id === stage.id && (
                <InfoWindow onCloseClick={() => setSelectedStage(null)}>
                  <div className="font-body">
                    <h4 className="font-heading font-semibold text-dark-gray mb-1">
                      {index + 1}. {stage.name}
                    </h4>
                    <p className="text-sm text-dark-gray/70">
                      {stage.latitude.toFixed(4)}, {stage.longitude.toFixed(4)}
                    </p>
                    {stage.notes && (
                      <p className="text-sm text-dark-gray/80 mt-2">{stage.notes}</p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
        {/* Marqueurs pour les points d'intérêt */}
        {validStages.map((stage) => {
          if (!stage.points_of_interest || stage.points_of_interest.length === 0) return null;
          
          return stage.points_of_interest
            .filter(poi => poi.lat && poi.lng)
            .map((poi, poiIndex) => {
              const poiIconUrl = `data:image/svg+xml;base64,${btoa(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#00B4D8" stroke="white" stroke-width="2"/>
                  <path d="M12 6v6l4 2" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
                </svg>
              `)}`;
              
              return (
                <Marker
                  key={`poi-${stage.id}-${poiIndex}`}
                  position={{ lat: poi.lat!, lng: poi.lng! }}
                  icon={{
                    url: poiIconUrl,
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                  }}
                />
              );
            });
        })}
        {validStages.length > 1 && (
          <Polyline
            path={validStages.map(s => ({ lat: s.latitude, lng: s.longitude }))}
            options={{
              strokeColor: '#FFC857',
              strokeWeight: 3,
              strokeOpacity: 0.7
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
