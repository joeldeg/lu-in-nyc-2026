'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

type Discovery = {
  id: string
  photo_url: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  members: {
    name: string
  } | null
}

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

export default function DiscoveryMap({
  discoveries
}: {
  discoveries: Discovery[]
}) {
  const mappedDiscoveries = discoveries.filter(
    (d) => d.latitude && d.longitude
  )

  return (
    <div className="h-[500px] w-full rounded-3xl overflow-hidden border border-zinc-800">
      <MapContainer
        center={[40.7411, -73.9897]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappedDiscoveries.map((discovery) => (
          <Marker
            key={discovery.id}
            position={[discovery.latitude!, discovery.longitude!]}
            icon={markerIcon}
          >
            <Popup>
              <div className="w-48">
                <img
                  src={discovery.photo_url}
                  alt={discovery.caption ?? 'NYC moment'}
                  className="w-full rounded-lg mb-2"
                />

                <p className="font-semibold">
                  {discovery.caption || 'NYC Moment'}
                </p>

                <p className="text-sm text-zinc-500">
                  {discovery.members?.name ?? 'Someone'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}