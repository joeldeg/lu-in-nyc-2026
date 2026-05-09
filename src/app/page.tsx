'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import exifr from 'exifr'

const DiscoveryMap = dynamic(
  () => import('@/components/DiscoveryMap'),
  { ssr: false }
)

const TRIP_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_MOMENT_GOAL = 60
const TEAM_SIZE = 4

type Coordinates = {
  latitude: number
  longitude: number
}

type Place = {
  id: string
  name: string
  category: string
  points: number
  latitude: number | null
  longitude: number | null
}

type Discovery = {
  id: string
  photo_url: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  points: number
  place_id: string | null
  created_at: string
  members: { name: string } | { name: string }[] | null
}

type IconName = 'home' | 'quests' | 'camera' | 'map' | 'journal' | 'group'

function FlatIcon({
  name,
  className = 'h-7 w-7'
}: {
  name: IconName
  className?: string
}) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.6v-6.2H9.1V21H3.5a.5.5 0 0 1-.5-.5v-9.7Z" />
      </svg>
    )
  }

  if (name === 'quests') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <rect x="5" y="3" width="14" height="18" rx="2.5" fill="currentColor" />
        <path d="M9 8h6M9 12h6M9 16h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'camera') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M8.3 5h7.4l1.2 2H20a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3.1l1.2-2Z" />
        <circle cx="12" cy="13" r="4.1" fill="white" />
        <circle cx="12" cy="13" r="2.4" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'map') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M12 2.8a6.2 6.2 0 0 0-6.2 6.2c0 4.5 6.2 12.2 6.2 12.2S18.2 13.5 18.2 9A6.2 6.2 0 0 0 12 2.8Zm0 8.7A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
      </svg>
    )
  }

  if (name === 'journal') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17.5H7A3 3 0 0 0 4 22V4.5Z" />
        <path d="M8 6h8M8 10h8M8 14h5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="8" cy="8" r="3.2" />
      <circle cx="16" cy="8" r="3.2" />
      <path d="M2.8 20a5.4 5.4 0 0 1 10.4-2 5.4 5.4 0 0 1 8 2H2.8Z" />
    </svg>
  )
}

function hasCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

function toCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): Coordinates | null {
  if (!hasCoordinates(latitude, longitude)) return null

  return {
    latitude: latitude as number,
    longitude: longitude as number
  }
}

async function getCurrentCoordinates(): Promise<Coordinates | null> {
  if (!('geolocation' in navigator)) return null

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      })
    })

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    }
  } catch {
    console.log('Location permission skipped or unavailable.')
    return null
  }
}

export default function HomePage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [manualLatitude, setManualLatitude] = useState<number | null>(null)
  const [manualLongitude, setManualLongitude] = useState<number | null>(null)
  const [currentLatitude, setCurrentLatitude] = useState<number | null>(null)
  const [currentLongitude, setCurrentLongitude] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'ready' | 'unavailable'>('idle')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [memberName, setMemberName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCaptureForm, setShowCaptureForm] = useState(false)
  const [editingDiscovery, setEditingDiscovery] = useState<Discovery | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editPoints, setEditPoints] = useState(0)
  const [updating, setUpdating] = useState(false)
  const [activeView, setActiveView] = useState<'home' | 'quests' | 'map' | 'journal'>('home')

  useEffect(() => {
    fetchData()
  }, [])

  // ---- Data ----

  async function fetchData() {
    const [placesResponse, discoveriesResponse] = await Promise.all([
      supabase.from('places').select('*').order('created_at'),
      supabase
        .from('discoveries')
        .select('id, place_id, photo_url, caption, latitude, longitude, points, created_at, members(name)')
        .order('created_at', { ascending: false })
    ])

    if (placesResponse.data) setPlaces(placesResponse.data)
    const savedMemberName = localStorage.getItem('nyc-member-name')
    if (savedMemberName) setMemberName(savedMemberName)
    if (discoveriesResponse.data) setDiscoveries(discoveriesResponse.data as Discovery[])
    setLoading(false)
  }

  // ---- Helpers ----

  function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value))
  }

  // Supabase can return members as an object or array depending on the join
  function getMemberName(memberData: Discovery['members']) {
    if (!memberData) return 'Someone'
    if (Array.isArray(memberData)) return memberData[0]?.name ?? 'Someone'
    return memberData.name ?? 'Someone'
  }

  async function captureCurrentLocation() {
    setLocationStatus('checking')

    const coordinates = await getCurrentCoordinates()

    if (coordinates) {
      setCurrentLatitude(coordinates.latitude)
      setCurrentLongitude(coordinates.longitude)
      setLocationStatus('ready')
      return coordinates
    }

    setCurrentLatitude(null)
    setCurrentLongitude(null)
    setLocationStatus('unavailable')
    return null
  }

async function handlePhotoChange(file: File | null) {
  setPhoto(file)
  setManualLatitude(null)
  setManualLongitude(null)

  if (!file) {
    setPhotoPreview(null)
    return
  }

  setPhotoPreview(URL.createObjectURL(file))

  try {
    const gps = await exifr.gps(file)
    const gpsCoordinates = toCoordinates(gps?.latitude, gps?.longitude)

    if (gpsCoordinates) {
      setManualLatitude(gpsCoordinates.latitude)
      setManualLongitude(gpsCoordinates.longitude)
    }
  } catch {
    console.log('No GPS data found in photo EXIF.')
  }
}

  function openEditDiscovery(discovery: Discovery) {
    setEditingDiscovery(discovery)
    setEditCaption(discovery.caption ?? '')
    setEditPoints(discovery.points)
  }

  function openCaptureForm() {
    setShowCaptureForm(true)
    void captureCurrentLocation()
  }

  // ---- Handlers ----

  async function handleCaptureMoment(event: React.FormEvent) {
    event.preventDefault()

    if (!photo || !memberName.trim()) {
      alert('Choose a photo and a person first.')
      return
    }

    setSaving(true)

    let latitude: number | null = null
    let longitude: number | null = null

    const fileExt = photo.name.split('.').pop()
    const fileName = `${TRIP_ID}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('trip-photos')
      .upload(fileName, photo)

    if (uploadError) {
      alert('Photo upload failed.')
      console.error(uploadError)
      setSaving(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('trip-photos')
      .getPublicUrl(fileName)

    const normalizedMemberName = memberName.trim()
    let memberId: string | null = null

    const { data: existingMembers } = await supabase
      .from('members')
      .select('*')
      .eq('trip_id', TRIP_ID)
      .ilike('name', normalizedMemberName)
      .limit(1)

    const existingMember = existingMembers?.[0]

    if (existingMember) {
      memberId = existingMember.id
    } else {
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({ trip_id: TRIP_ID, name: normalizedMemberName })
        .select()
        .single()

      if (memberError || !newMember) {
        alert('Could not create member.')
        setSaving(false)
        return
      }

      memberId = newMember.id
    }

    const selectedPlace = places.find((place) => place.id === selectedPlaceId)
    const pointsToAward = selectedPlace ? selectedPlace.points : 5
    const photoCoordinates = toCoordinates(manualLatitude, manualLongitude)
    const currentCoordinates = toCoordinates(currentLatitude, currentLongitude)
    const selectedPlaceCoordinates = toCoordinates(
      selectedPlace?.latitude,
      selectedPlace?.longitude
    )

    if (photoCoordinates) {
      latitude = photoCoordinates.latitude
      longitude = photoCoordinates.longitude
    }

    if (!hasCoordinates(latitude, longitude) && currentCoordinates) {
      latitude = currentCoordinates.latitude
      longitude = currentCoordinates.longitude
    }

    const liveCoordinates = !hasCoordinates(latitude, longitude)
      ? await captureCurrentLocation()
      : null

    if (liveCoordinates) {
      latitude = liveCoordinates.latitude
      longitude = liveCoordinates.longitude
    }

    if (
      !hasCoordinates(latitude, longitude) &&
      selectedPlaceCoordinates
    ) {
      latitude = selectedPlaceCoordinates.latitude
      longitude = selectedPlaceCoordinates.longitude
    }

    if (!hasCoordinates(latitude, longitude)) {
      console.warn('Saving moment without coordinates. No photo GPS, browser location, or selected place coordinates were available.')
      alert('Location was not available. Please allow location access or choose a planned place before saving.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('discoveries').insert({
      trip_id: TRIP_ID,
      place_id: selectedPlaceId || null,
      member_id: memberId,
      photo_url: publicUrlData.publicUrl,
      caption,
      latitude,
      longitude,
      points: pointsToAward
    })

    if (insertError) {
      alert('Could not save the moment.')
      console.error(insertError)
      setSaving(false)
      return
    }

    setPhoto(null)
    setManualLatitude(null)
    setManualLongitude(null)
    setCurrentLatitude(null)
    setCurrentLongitude(null)
    setLocationStatus('idle')
    setPhotoPreview(null)
    setCaption('')
    setSelectedPlaceId('')
    setShowCaptureForm(false)
    await fetchData()
    setSaving(false)
  }

  async function handleUpdateDiscovery(event: React.FormEvent) {
    event.preventDefault()
    if (!editingDiscovery) return

    setUpdating(true)

    const { error } = await supabase
      .from('discoveries')
      .update({ caption: editCaption, points: editPoints })
      .eq('id', editingDiscovery.id)

    if (error) {
      alert('Could not update memory.')
      console.error(error)
      setUpdating(false)
      return
    }

    setEditingDiscovery(null)
    await fetchData()
    setUpdating(false)
  }

  async function handleDeleteDiscovery() {
    if (!editingDiscovery) return

    const confirmed = window.confirm('Delete this memory? This cannot be undone.')
    if (!confirmed) return

    setUpdating(true)

    const { error } = await supabase
      .from('discoveries')
      .delete()
      .eq('id', editingDiscovery.id)

    if (error) {
      alert('Could not delete memory.')
      console.error(error)
      setUpdating(false)
      return
    }

    setEditingDiscovery(null)
    await fetchData()
    setUpdating(false)
  }

  // ---- Modals ----

  function renderCaptureModal() {
    const selectedPlace = places.find((place) => place.id === selectedPlaceId)
    const photoCoordinates = toCoordinates(manualLatitude, manualLongitude)
    const currentCoordinates = toCoordinates(currentLatitude, currentLongitude)
    const selectedPlaceCoordinates = toCoordinates(
      selectedPlace?.latitude,
      selectedPlace?.longitude
    )
    const availableCoordinates =
      photoCoordinates ?? currentCoordinates ?? selectedPlaceCoordinates

    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end justify-center">
        <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold">📸 Capture Moment</h2>
            <button
              type="button"
              onClick={() => setShowCaptureForm(false)}
              className="text-zinc-400 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCaptureMoment}>
            <label className="block text-sm text-zinc-400 mb-2">Your name</label>
            <input
              value={memberName}
              onChange={(e) => {
                setMemberName(e.target.value)
                localStorage.setItem('nyc-member-name', e.target.value)
              }}
              placeholder="Enter your name"
              className="w-full mb-4 rounded-xl bg-white border border-zinc-300 p-3 text-zinc-950 placeholder:text-zinc-500"
            />

            <label className="block text-sm text-zinc-400 mb-2">Where are we?</label>
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              className="w-full mb-4 rounded-xl bg-white border border-zinc-300 p-3 text-zinc-950"
            >
              <option value="">Just a moment</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {place.points} pts
                </option>
              ))}
            </select>

            <label className="block text-sm text-zinc-400 mb-2">Photo</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-4 text-center text-sm font-semibold text-yellow-400">
                Take Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>

              <label className="rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-4 text-center text-sm font-semibold text-yellow-400">
                Choose Library
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
            </div>

            {photoPreview && (
              <div className="mb-4">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full max-h-64 object-cover rounded-2xl border border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    setPhotoPreview(null)
                    setManualLatitude(null)
                    setManualLongitude(null)
                  }}
                  className="mt-2 text-sm text-zinc-400 underline"
                >
                  Remove photo
                </button>
              </div>
            )}

            <label className="block text-sm text-zinc-400 mb-2">Caption</label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What did we find?"
              className="w-full mb-4 rounded-xl bg-white border border-zinc-300 p-3 text-zinc-950 placeholder:text-zinc-500"
            />

            <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {availableCoordinates ? 'Location ready' : 'Location needed'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {photoCoordinates && 'Using photo GPS'}
                    {!photoCoordinates && currentCoordinates && 'Using phone location'}
                    {!photoCoordinates && !currentCoordinates && selectedPlaceCoordinates && 'Using selected place'}
                    {!availableCoordinates && locationStatus === 'checking' && 'Checking phone location...'}
                    {!availableCoordinates && locationStatus !== 'checking' && 'Allow location or choose a planned place'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={captureCurrentLocation}
                  disabled={locationStatus === 'checking'}
                  className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-yellow-400 disabled:opacity-50"
                >
                  {locationStatus === 'checking' ? 'Checking' : 'Use GPS'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Moment'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  function renderEditModal() {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end justify-center">
        <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold">Edit Memory</h2>
            <button
              type="button"
              onClick={() => setEditingDiscovery(null)}
              className="text-zinc-400 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleUpdateDiscovery}>
            <label className="block text-sm text-zinc-400 mb-2">Caption</label>
            <input
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="w-full mb-4 rounded-xl bg-zinc-800 border border-zinc-700 p-3"
            />

            <label className="block text-sm text-zinc-400 mb-2">Points</label>
            <input
              type="number"
              value={editPoints}
              onChange={(e) => setEditPoints(Number(e.target.value))}
              className="w-full mb-4 rounded-xl bg-zinc-800 border border-zinc-700 p-3"
            />

            <button
              type="submit"
              disabled={updating}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={handleDeleteDiscovery}
              disabled={updating}
              className="w-full mt-3 bg-red-950 text-red-300 border border-red-900 font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
            >
              Delete Memory
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ---- Nav ----

  function renderBottomNav() {
    const navItems: Array<{
      id: 'home' | 'quests' | 'map' | 'journal'
      label: string
      icon: IconName
    }> = [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'quests', label: 'Quests', icon: 'quests' },
      { id: 'map', label: 'Map', icon: 'map' },
      { id: 'journal', label: 'Journal', icon: 'journal' }
    ]

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[9997] bg-zinc-950 text-white shadow-[0_-12px_30px_rgba(0,0,0,0.28)]">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center px-4 py-3">
          {navItems.slice(0, 2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-1 ${activeView === item.id ? 'text-yellow-300' : 'text-zinc-400'}`}
            >
              <FlatIcon name={item.icon} className="h-7 w-7" />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}

          <button
            type="button"
            aria-label="Capture"
            onClick={openCaptureForm}
            className="relative -mt-10 mx-auto bg-yellow-400 text-black w-20 h-20 rounded-full border-4 border-white shadow-2xl flex items-center justify-center"
          >
            <FlatIcon name="camera" className="h-10 w-10" />
          </button>

          {navItems.slice(2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-1 ${activeView === item.id ? 'text-yellow-300' : 'text-zinc-400'}`}
            >
              <FlatIcon name={item.icon} className="h-7 w-7" />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    )
  }

  // ---- Stats ----

  const totalPoints = discoveries.reduce((sum, item) => sum + item.points, 0)
  const visitedPlaceIds = new Set(discoveries.map((d) => d.place_id).filter(Boolean))
  const visitedPlacesCount = visitedPlaceIds.size
  const momentProgress = Math.min(discoveries.length / TEAM_MOMENT_GOAL, 1)
  const momentProgressPercent = Math.round(momentProgress * 100)
  const momentsRemaining = Math.max(TEAM_MOMENT_GOAL - discoveries.length, 0)
  const nextTier = totalPoints >= 500
    ? 'Navigator'
    : totalPoints >= 250
      ? 'Adventurer'
      : totalPoints >= 100
        ? 'Explorer'
        : 'Rookie'
  const actionCards: Array<{
    label: string
    helper: string
    icon: IconName
    color: string
    onClick: () => void
  }> = [
    {
      label: 'Capture',
      helper: 'Add a moment',
      icon: 'camera',
      color: 'bg-blue-700 text-white',
      onClick: openCaptureForm
    },
    {
      label: 'Quests',
      helper: 'View stops',
      icon: 'quests',
      color: 'bg-white text-blue-700',
      onClick: () => setActiveView('quests')
    },
    {
      label: 'Map',
      helper: 'See progress',
      icon: 'map',
      color: 'bg-white text-green-700',
      onClick: () => setActiveView('map')
    },
    {
      label: 'Journal',
      helper: 'Our story',
      icon: 'journal',
      color: 'bg-white text-purple-700',
      onClick: () => setActiveView('journal')
    }
  ]

  // ---- Render ----

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-zinc-950 p-5">
      <div className="max-w-md mx-auto pb-32">

        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-blue-700 text-white flex items-center justify-center text-xl font-black tracking-tight">
                NYC
              </div>
              <div>
                <p className="text-xs font-black uppercase text-blue-700">Weekend Quest</p>
                <h1 className="text-3xl font-black leading-none">Lu in NYC 2026</h1>
              </div>
            </div>

            <div className="text-center">
              <div className="relative mx-auto h-14 w-14 rounded-full bg-white border border-zinc-200 shadow flex items-center justify-center text-zinc-950">
                <FlatIcon name="group" className="h-8 w-8" />
                <span className="absolute -right-1 -top-1 h-6 min-w-6 rounded-full bg-blue-700 px-1 text-sm font-black text-white">
                  {TEAM_SIZE}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-zinc-500">Our Group</p>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-[28px] bg-zinc-950 p-5 text-white shadow-xl">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Moments</p>
              <p className="mt-1 text-5xl font-black leading-none">
                {discoveries.length}
                <span className="text-3xl text-zinc-300"> / {TEAM_MOMENT_GOAL}</span>
              </p>
              <p className="mt-2 text-sm font-bold text-white">Captured together</p>
            </div>

            <div className="border-l border-white/15 pl-5">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-300">Team Points</p>
              <p className="mt-1 text-5xl font-black leading-none text-yellow-400">{totalPoints}</p>
              <p className="mt-2 text-sm font-bold text-white">{nextTier} tier</p>
            </div>
          </div>

          <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-yellow-400"
              style={{ width: `${momentProgressPercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-zinc-300">
            {momentProgressPercent}% complete · {momentsRemaining} moments left · {visitedPlacesCount} places visited
          </p>
        </section>

        {activeView === 'home' && (
          <section className="mb-6 grid grid-cols-4 gap-3">
            {actionCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={`min-h-32 rounded-2xl p-3 text-center shadow ${card.color}`}
              >
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-current/10">
                  <FlatIcon name={card.icon} className="h-8 w-8" />
                </span>
                <span className="block text-sm font-black uppercase leading-tight">{card.label}</span>
                <span className="mt-2 block text-xs font-medium opacity-75">{card.helper}</span>
              </button>
            ))}
          </section>
        )}

        {activeView === 'home' && (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-black mb-4">Adventure Map</h2>
              <DiscoveryMap discoveries={discoveries} />
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-black mb-4">Recent Moments</h2>

              {discoveries.length === 0 ? (
                <p className="text-zinc-500">No moments yet. Capture the first one!</p>
              ) : (
                <div className="space-y-5">
                  {discoveries.map((discovery) => (
                    <div
                      key={discovery.id}
                      className="bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow"
                    >
                      <img
                        src={discovery.photo_url}
                        alt={discovery.caption ?? 'NYC moment'}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="p-4">
                        <p className="font-semibold">{discovery.caption || 'NYC moment'}</p>
                        <p className="text-sm text-zinc-500 mt-1">
                          {getMemberName(discovery.members)} · {discovery.points} pts · {formatTimestamp(discovery.created_at)}
                        </p>
                        <button
                          type="button"
                          onClick={() => openEditDiscovery(discovery)}
                          className="mt-3 text-sm text-blue-700 font-black"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-black mb-4">Planned Places</h2>

              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-4">
                  {places.map((place) => (
                    <div
                      key={place.id}
                      className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-lg font-semibold">{place.name}</p>
                          <p className="text-zinc-500 text-sm">{place.category}</p>
                        </div>
                        <div className="bg-yellow-400 text-black px-3 py-1 rounded-full font-black text-sm">
                          {place.points} pts
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

{/* -----  Quests view  ---- */}
{activeView === 'quests' && (
  <section className="pb-24">
    <h2 className="text-3xl font-black mb-6">
      Quest List
    </h2>

    <div className="space-y-4">
      {places.map((place) => (
        <div
          key={place.id}
          className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-semibold">
                {place.name}
              </p>

              <p className="text-zinc-500 text-sm">
                {place.category}
              </p>
            </div>

            <div className="bg-yellow-400 text-black px-3 py-1 rounded-full font-black text-sm">
              {place.points} pts
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{/* ------  Map view --------- */}
{activeView === 'map' && (
  <section className="pb-24">
    <h2 className="text-3xl font-black mb-6">
      Adventure Map
    </h2>

    <DiscoveryMap discoveries={discoveries} />
  </section>
)}

{/* ----  Journal view  ------- */}
{activeView === 'journal' && (
  <section className="pb-24">
    <h2 className="text-3xl font-black mb-6">
      Journal Timeline
    </h2>

    <div className="space-y-5">
      {discoveries.map((discovery) => (
        <div
          key={discovery.id}
          className="bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow"
        >
          <img
            src={discovery.photo_url}
            alt={discovery.caption ?? 'NYC moment'}
            className="w-full aspect-square object-cover"
          />

          <div className="p-4">
            <p className="font-semibold">
              {discovery.caption || 'NYC moment'}
            </p>

            <p className="text-sm text-zinc-500 mt-1">
              {getMemberName(discovery.members)} · {discovery.points} pts · {formatTimestamp(discovery.created_at)}
            </p>

            <button
              type="button"
              onClick={() => openEditDiscovery(discovery)}
              className="mt-3 text-sm text-blue-700 font-black"
            >
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

      </div>

      {showCaptureForm && renderCaptureModal()}
      {editingDiscovery && renderEditModal()}
      {renderBottomNav()}
    </main>
  )
}
