import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Stage {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes?: string | null;
}

interface StagesMapProps {
  stages: Stage[];
}

// Corriger les icônes Leaflet par défaut
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

export function StagesMap({ stages }: StagesMapProps) {
  const [isMounted, setIsMounted] = useState(false);

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

  const firstStage = stages[0];
  if (!firstStage || typeof firstStage.latitude !== 'number' || typeof firstStage.longitude !== 'number') {
    return (
      <div className="bg-cream rounded-button h-96 flex items-center justify-center">
        <div className="text-center text-dark-gray/60 font-body">
          <p>Coordonnées invalides</p>
        </div>
      </div>
    );
  }

  // Filtrer les étapes valides avec useMemo
  const validStages = useMemo(() => {
    return stages.filter(stage => 
      typeof stage.latitude === 'number' && 
      typeof stage.longitude === 'number' &&
      !isNaN(stage.latitude) && 
      !isNaN(stage.longitude)
    );
  }, [stages]);

  return (
    <div className="rounded-button overflow-hidden" style={{ height: '384px' }}>
      <MapContainer
        key={`map-${firstStage.id}-${stages.length}`}
        center={[firstStage.latitude, firstStage.longitude] as [number, number]}
        zoom={stages.length === 1 ? 10 : stages.length === 2 ? 7 : 5}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validStages.map((stage, index) => {
          // Créer l'icône directement (sans useMemo dans le callback)
          const iconHtml = `
            <div style="
              background: linear-gradient(135deg, #FFC857 0%, #00B4D8 100%);
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            ">${index + 1}</div>
          `;
          
          const icon = L.divIcon({
            className: 'custom-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          return (
            <Marker
              key={`marker-${stage.id}-${index}`}
              position={[stage.latitude, stage.longitude] as [number, number]}
              icon={icon}
            >
              <Popup>
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
              </Popup>
            </Marker>
          );
        })}
        {validStages.length > 1 && (
          <Polyline
            positions={validStages.map(s => [s.latitude, s.longitude] as [number, number])}
            color="#FFC857"
            weight={3}
            opacity={0.7}
            dashArray="10, 5"
          />
        )}
      </MapContainer>
    </div>
  );
}
