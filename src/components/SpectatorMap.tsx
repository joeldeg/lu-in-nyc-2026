'use client'

import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'

export type SpectatorDiscovery = {
  id: string
  photo_url: string
  created_at: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  points: number
  members:
  | {
      name: string
    }
  | {
      name: string
    }[]
  | null
}

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function getMemberName(memberData: SpectatorDiscovery['members']) {
  if (!memberData) return 'Someone'
  if (Array.isArray(memberData)) return memberData[0]?.name ?? 'Someone'
  return memberData.name ?? 'Someone'
}

export default function SpectatorMap({
  discoveries,
  focusDiscoveryId,
  onOpenImage
}: {
  discoveries: SpectatorDiscovery[]
  focusDiscoveryId: string | null
  onOpenImage: (discovery: SpectatorDiscovery) => void
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  const mappedDiscoveries = useMemo(
    () => discoveries.filter(
      (d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
    ),
    [discoveries]
  )

  useEffect(() => {
    if (!mapElementRef.current) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markersRef.current.clear()
    }

    const map = L.map(mapElementRef.current).setView([40.7411, -73.9897], 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    const bounds: L.LatLngTuple[] = []
    const markers = new Map<string, L.Marker>()

    mappedDiscoveries.forEach((discovery) => {
      const latitude = discovery.latitude as number
      const longitude = discovery.longitude as number
      bounds.push([latitude, longitude])

      const popupContent = document.createElement('div')
      popupContent.className = 'w-56'

      const imageButton = document.createElement('button')
      imageButton.type = 'button'
      imageButton.className = 'block w-full overflow-hidden rounded-xl mb-3'

      const image = document.createElement('img')
      image.src = discovery.photo_url
      image.alt = discovery.caption ?? 'NYC moment'
      image.className = 'h-36 w-full object-cover'

      const caption = document.createElement('p')
      caption.className = 'font-bold text-zinc-950'
      caption.textContent = discovery.caption || 'NYC Moment'

      const detail = document.createElement('p')
      detail.className = 'text-sm text-zinc-500'
      detail.textContent = `${getMemberName(discovery.members)} · ${discovery.points} pts`

      const timestamp = document.createElement('p')
      timestamp.className = 'text-xs text-zinc-400'
      timestamp.textContent = formatTimestamp(discovery.created_at)

      imageButton.append(image)
      imageButton.addEventListener('click', () => onOpenImage(discovery))
      popupContent.append(imageButton, caption, detail, timestamp)

      const marker = L.marker([latitude, longitude], { icon: markerIcon })
        .addTo(map)
        .bindPopup(popupContent)

      markers.set(discovery.id, marker)
    })

    markersRef.current = markers

    if (bounds.length > 0) {
      map.fitBounds(bounds, { maxZoom: 15, padding: [30, 30] })
    }

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [mappedDiscoveries, onOpenImage])

  useEffect(() => {
    if (!focusDiscoveryId || !mapRef.current) return

    const marker = markersRef.current.get(focusDiscoveryId)
    if (!marker) return

    const position = marker.getLatLng()
    mapRef.current.setView(position, 16)
    marker.openPopup()
  }, [focusDiscoveryId])

  if (mappedDiscoveries.length === 0) {
    return (
      <div className="min-h-[60vh] w-full rounded-[28px] border border-zinc-100 bg-white p-6 flex items-center justify-center text-center shadow-sm">
        <p className="text-sm font-semibold text-zinc-500">
          The team&apos;s mapped memories will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[68vh] min-h-[520px] w-full rounded-[28px] overflow-hidden border border-zinc-100 shadow-xl">
      <div ref={mapElementRef} className="h-full w-full" />
    </div>
  )
}
