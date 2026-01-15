import { useEffect, useMemo, useRef, useState } from 'react';
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
  onAddPoiToStage?: (poi: PointOfInterest, stageId: string) => void | Promise<void>;
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
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const projectionRef = useRef<google.maps.MapCanvasProjection | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyLocation, setNearbyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStageId, setNearbyStageId] = useState<string | null>(null);
  const [nearbySuggestions, setNearbySuggestions] = useState<PointOfInterest[]>([]);

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
    // Créer PlacesService sur la map (pour nearbySearch)
    if (typeof google !== 'undefined' && google.maps?.places) {
      placesServiceRef.current = new google.maps.places.PlacesService(mapInstance);
    }
    // Créer une OverlayView invisible pour obtenir une projection (conversion pixel -> lat/lng)
    if (typeof google !== 'undefined' && google.maps?.OverlayView) {
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = () => {};
      overlay.draw = () => {
        // getProjection() devient dispo après draw()
        projectionRef.current = overlay.getProjection();
      };
      overlay.onRemove = () => {};
      overlay.setMap(mapInstance);
    }
    if (validStages.length > 1 && typeof google !== 'undefined' && google.maps) {
      const bounds = new google.maps.LatLngBounds();
      validStages.forEach(stage => {
        bounds.extend(new google.maps.LatLng(stage.latitude, stage.longitude));
      });
      mapInstance.fitBounds(bounds);
    }
  };

  const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
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

  const findNearestStageId = (lat: number, lng: number) => {
    if (validStages.length === 0) return null;
    let bestId = validStages[0].id;
    let bestDist = Infinity;
    for (const s of validStages) {
      const d = haversineMeters({ lat, lng }, { lat: s.latitude, lng: s.longitude });
      if (d < bestDist) {
        bestDist = d;
        bestId = s.id;
      }
    }
    return bestId;
  };

  const fetchNearbyActivities = async (lat: number, lng: number) => {
    setNearbyLoading(true);
    setNearbyError('');
    setNearbySuggestions([]);

    if (!placesServiceRef.current) {
      setNearbyError('Service Places indisponible (vérifiez la librairie Google "places").');
      setNearbyLoading(false);
      return;
    }

    try {
      const location = new google.maps.LatLng(lat, lng);
      const types: string[] = [
        'tourist_attraction',
        'museum',
        'park',
        'art_gallery',
        'restaurant',
        'cafe'
      ];

      const seen = new Set<string>();
      const merged: PointOfInterest[] = [];

      const runNearby = (type: string) =>
        new Promise<void>((resolve) => {
          placesServiceRef.current?.nearbySearch(
            {
              location,
              radius: 1000, // 1 km
              type,
              language: 'fr'
            },
            (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                for (const place of results) {
                  if (merged.length >= 5) break;
                  const id = place.place_id || place.name || `${type}-${place.vicinity}`;
                  if (seen.has(id)) continue;
                  if (!place.name || !place.geometry?.location) continue;
                  seen.add(id);
                  merged.push({
                    title: place.name,
                    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    needsTransport: false
                  });
                }
              }
              resolve();
            }
          );
        });

      await Promise.all(types.map(runNearby));

      if (merged.length === 0) {
        setNearbyError('Aucune activité trouvée à moins de 1 km.');
      } else {
        setNearbySuggestions(merged.slice(0, 5));
      }
    } catch (e) {
      console.error('Erreur nearbySearch:', e);
      setNearbyError('Erreur lors de la recherche d’activités à proximité.');
    } finally {
      setNearbyLoading(false);
    }
  };

  const handlePickPoint = (lat: number, lng: number) => {
    const stageId = findNearestStageId(lat, lng);
    setNearbyLocation({ lat, lng });
    setNearbyStageId(stageId);
    setNearbyOpen(true);
    void fetchNearbyActivities(lat, lng);
  };

  // Support mobile/tablette: appui prolongé (touch) sur la carte
  useEffect(() => {
    if (!map) return;

    const div = map.getDiv();
    if (!div) return;

    const clearTimer = () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onTouchStart = (ev: TouchEvent) => {
      if (!ev.touches || ev.touches.length !== 1) return;
      touchMovedRef.current = false;

      const t = ev.touches[0];
      const rect = div.getBoundingClientRect();
      touchStartRef.current = { x: t.clientX - rect.left, y: t.clientY - rect.top };

      clearTimer();
      // Long press ~ 550ms
      longPressTimerRef.current = window.setTimeout(() => {
        if (touchMovedRef.current) return;
        const start = touchStartRef.current;
        const proj = projectionRef.current;
        if (!start || !proj) return;

        // Convertit pixel (container) -> LatLng
        const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(start.x, start.y));
        if (!latLng) return;
        handlePickPoint(latLng.lat(), latLng.lng());
      }, 550);
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (!touchStartRef.current || !ev.touches || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const rect = div.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      const dx = x - touchStartRef.current.x;
      const dy = y - touchStartRef.current.y;
      // Si l'utilisateur “glisse” (pan/scroll), on annule le long press
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        touchMovedRef.current = true;
        clearTimer();
      }
    };

    const onTouchEnd = () => {
      clearTimer();
      touchStartRef.current = null;
      touchMovedRef.current = false;
    };

    // passive: true pour ne pas bloquer le scroll / gestures
    div.addEventListener('touchstart', onTouchStart, { passive: true });
    div.addEventListener('touchmove', onTouchMove, { passive: true });
    div.addEventListener('touchend', onTouchEnd, { passive: true });
    div.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      clearTimer();
      div.removeEventListener('touchstart', onTouchStart as any);
      div.removeEventListener('touchmove', onTouchMove as any);
      div.removeEventListener('touchend', onTouchEnd as any);
      div.removeEventListener('touchcancel', onTouchEnd as any);
    };
  }, [map, validStages]);

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
        onRightClick={(e) => {
          // Desktop / souris: clic droit
          if (!e.latLng) return;
          handlePickPoint(e.latLng.lat(), e.latLng.lng());
        }}
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
                  <!-- Pin "map marker" -->
                  <path d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 14 6 14s6-9.5 6-14c0-3.314-2.686-6-6-6z" fill="#00B4D8" stroke="white" stroke-width="2"/>
                  <circle cx="12" cy="8" r="2.5" fill="white"/>
                </svg>
              `)}`;
              
              return (
                <Marker
                  key={`poi-${stage.id}-${poiIndex}`}
                  position={{ lat: poi.lat!, lng: poi.lng! }}
                  icon={{
                    url: poiIconUrl,
                    scaledSize: new google.maps.Size(24, 24),
                    // ancre en bas du pin
                    anchor: new google.maps.Point(12, 24)
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

      {nearbyOpen && (
        <div
          className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-10"
          onClick={() => setNearbyOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-medium w-full max-w-md p-4 sm:p-6"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-heading font-bold text-dark-gray break-words">
                  Activités à proximité (1 km)
                </h3>
                {nearbyLocation && (
                  <p className="text-xs text-dark-gray/60 font-body">
                    Point: {nearbyLocation.lat.toFixed(4)}, {nearbyLocation.lng.toFixed(4)}
                  </p>
                )}
                {nearbyStageId && (
                  <p className="text-xs text-dark-gray/60 font-body">
                    Étape ciblée: {validStages.find(s => s.id === nearbyStageId)?.name || '—'}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-dark-gray/60 hover:text-dark-gray"
                onClick={() => setNearbyOpen(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {nearbyLoading && (
              <div className="text-center py-6">
                <div className="w-10 h-10 border-4 border-turquoise border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-3 text-sm text-dark-gray/70 font-body">Recherche en cours…</p>
              </div>
            )}

            {!nearbyLoading && nearbyError && (
              <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-button p-3 text-burnt-orange text-sm font-body">
                {nearbyError}
              </div>
            )}

            {!nearbyLoading && !nearbyError && nearbySuggestions.length > 0 && (
              <div className="space-y-2">
                {nearbySuggestions.map((sugg, idx) => (
                  <div key={`${sugg.title}-${idx}`} className="bg-cream rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body font-semibold text-dark-gray break-words">{sugg.title}</p>
                      <a
                        href={sugg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-turquoise hover:text-turquoise/80 font-body break-all"
                      >
                        Voir sur la carte
                      </a>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-turquoise text-white font-body font-semibold rounded-button hover:bg-turquoise/90 transition-colors flex-shrink-0"
                      onClick={async () => {
                        if (!nearbyStageId) return;
                        try {
                          await onAddPoiToStage?.(sugg, nearbyStageId);
                          setNearbyOpen(false);
                        } catch (err) {
                          console.error('Erreur add poi:', err);
                          setNearbyError('Erreur lors de l’ajout de l’activité.');
                        }
                      }}
                    >
                      Ajouter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
