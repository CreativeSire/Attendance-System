import { useMemo } from 'react';
import { Circle, MapContainer, Polygon, TileLayer, useMapEvents } from 'react-leaflet';
import type { OfficeLocation, OfficeZone } from '@/types';

type DraftGeometry =
  | { type: 'circle'; centerLat: number; centerLng: number; radiusMeters: number }
  | { type: 'polygon'; points: Array<{ lat: number; lng: number }> };

function ClickCapture({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function zoneGeometry(zone: OfficeZone): DraftGeometry {
  if (zone.geometry && zone.geometry.type === 'polygon' && Array.isArray(zone.geometry.points)) {
    return {
      type: 'polygon',
      points: zone.geometry.points as Array<{ lat: number; lng: number }>,
    };
  }

  return {
    type: 'circle',
    centerLat: zone.centerLat,
    centerLng: zone.centerLng,
    radiusMeters: zone.radiusMeters,
  };
}

const zoneColors: Record<OfficeZone['type'], string> = {
  entry_zone: '#9B95FF',
  work_zone: '#33d17a',
  staff_quarters_zone: '#f59e0b',
  admin_zone: '#38bdf8',
  warehouse_zone: '#a78bfa',
  restricted_zone: '#ef4444',
};

export default function ZoneMap({
  office,
  zones,
  draft,
  onMapClick,
}: {
  office?: OfficeLocation;
  zones: OfficeZone[];
  draft?: DraftGeometry | null;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const center = useMemo<[number, number]>(() => {
    if (draft?.type === 'circle') return [draft.centerLat, draft.centerLng];
    if (draft?.type === 'polygon' && draft.points[0]) return [draft.points[0].lat, draft.points[0].lng];
    if (office) return [office.latitude, office.longitude];
    if (zones[0]) return [zones[0].centerLat, zones[0].centerLng];
    return [6.5244, 3.3792];
  }, [draft, office, zones]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <MapContainer center={center} zoom={18} scrollWheelZoom className="h-[420px] w-full bg-background">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick ? <ClickCapture onClick={onMapClick} /> : null}

        {office ? (
          <Circle
            center={[office.latitude, office.longitude]}
            radius={office.radiusMeters}
            pathOptions={{ color: '#6C63FF', fillColor: '#6C63FF', fillOpacity: 0.08, weight: 2 }}
          />
        ) : null}

        {zones.map((zone) => {
          const geometry = zoneGeometry(zone);
          const color = zoneColors[zone.type] ?? '#9B95FF';

          if (geometry.type === 'polygon') {
            return (
              <Polygon
                key={zone.id}
                positions={geometry.points.map((point) => [point.lat, point.lng])}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
              />
            );
          }

          return (
            <Circle
              key={zone.id}
              center={[geometry.centerLat, geometry.centerLng]}
              radius={geometry.radiusMeters}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
            />
          );
        })}

        {draft?.type === 'circle' ? (
          <Circle
            center={[draft.centerLat, draft.centerLng]}
            radius={draft.radiusMeters}
            pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.08, dashArray: '8 8' }}
          />
        ) : null}

        {draft?.type === 'polygon' && draft.points.length >= 2 ? (
          <Polygon
            positions={draft.points.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.08, dashArray: '8 8' }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
