'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const DiscoveryMap = dynamic(
  () => import('@/components/DiscoveryMap'),
  { ssr: false }
)

const TRIP_ID = '11111111-1111-1111-1111-111111111111'

type Place = {
  id: string
  name: string
  category: string
  points: number
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

export default function HomePage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
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

  function handlePhotoChange(file: File | null) {
    setPhoto(file)
    if (!file) {
      setPhotoPreview(null)
      return
    }
    setPhotoPreview(URL.createObjectURL(file))
  }

  function openEditDiscovery(discovery: Discovery) {
    setEditingDiscovery(discovery)
    setEditCaption(discovery.caption ?? '')
    setEditPoints(discovery.points)
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

    try {
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000
          })
        })
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      }
    } catch {
      console.log('Location permission skipped or unavailable.')
    }

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

  function CaptureModal() {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end justify-center">
        <div className="w-full max-w-md bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6">
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
              className="w-full mb-4 rounded-xl bg-zinc-800 border border-zinc-700 p-3"
            />

            <label className="block text-sm text-zinc-400 mb-2">Where are we?</label>
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              className="w-full mb-4 rounded-xl bg-zinc-800 border border-zinc-700 p-3"
            >
              <option value="">Just a moment</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {place.points} pts
                </option>
              ))}
            </select>

            <label className="block text-sm text-zinc-400 mb-2">Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
              className="w-full mb-4 text-sm"
            />

            {photoPreview && (
              <div className="mb-4">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full aspect-square object-cover rounded-2xl border border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    setPhotoPreview(null)
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
              className="w-full mb-4 rounded-xl bg-zinc-800 border border-zinc-700 p-3"
            />

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

  function EditModal() {
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

  function BottomNav() {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[9997] bg-zinc-950/95 backdrop-blur border-t border-zinc-800">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className={activeView === 'home' ? 'text-yellow-400' : 'text-zinc-400'}
          >
            <div className="text-2xl">🏠</div>
            <div className="text-xs">Home</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('quests')}
            className={activeView === 'quests' ? 'text-yellow-400' : 'text-zinc-400'}
          >
            <div className="text-2xl">📋</div>
            <div className="text-xs">Quests</div>
          </button>

          <button
            type="button"
            onClick={() => setShowCaptureForm(true)}
            className="relative -mt-10 mx-auto bg-yellow-400 text-black w-20 h-20 rounded-full border-4 border-zinc-950 shadow-2xl flex items-center justify-center text-3xl"
          >
            📸
          </button>

          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={activeView === 'map' ? 'text-yellow-400' : 'text-zinc-400'}
          >
            <div className="text-2xl">📍</div>
            <div className="text-xs">Map</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('journal')}
            className={activeView === 'journal' ? 'text-yellow-400' : 'text-zinc-400'}
          >
            <div className="text-2xl">📖</div>
            <div className="text-xs">Journal</div>
          </button>
        </div>
      </nav>
    )
  }

  // ---- Stats ----

  const totalPoints = discoveries.reduce((sum, item) => sum + item.points, 0)
  const visitedPlaceIds = new Set(discoveries.map((d) => d.place_id).filter(Boolean))
  const visitedPlacesCount = visitedPlaceIds.size

  // ---- Render ----

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-md mx-auto pb-32">

        <div className="mb-8">
          <p className="text-yellow-400 uppercase tracking-widest text-sm">NYC Weekend Adventure</p>
          <h1 className="text-4xl font-bold mt-2">Lu in NYC 2026</h1>

          <div className="grid grid-cols-4 gap-2 mt-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold">{discoveries.length}</p>
              <p className="text-xs text-zinc-400">Moments</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold">{totalPoints}</p>
              <p className="text-xs text-zinc-400">Points</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold">{visitedPlacesCount}</p>
              <p className="text-xs text-zinc-400">Places</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold">{places.length}</p>
              <p className="text-xs text-zinc-400">Stops</p>
            </div>
          </div>
        </div>

        {activeView === 'home' && (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Adventure Map</h2>
              <DiscoveryMap discoveries={discoveries} />
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Recent Moments</h2>

              {discoveries.length === 0 ? (
                <p className="text-zinc-400">No moments yet. Capture the first one!</p>
              ) : (
                <div className="space-y-5">
                  {discoveries.map((discovery) => (
                    <div
                      key={discovery.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
                    >
                      <img
                        src={discovery.photo_url}
                        alt={discovery.caption ?? 'NYC moment'}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="p-4">
                        <p className="font-semibold">{discovery.caption || 'NYC moment'}</p>
                        <p className="text-sm text-zinc-400 mt-1">
                          {getMemberName(discovery.members)} · {discovery.points} pts · {formatTimestamp(discovery.created_at)}
                        </p>
                        <button
                          type="button"
                          onClick={() => openEditDiscovery(discovery)}
                          className="mt-3 text-sm text-yellow-400 font-semibold"
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
              <h2 className="text-2xl font-semibold mb-4">Planned Places</h2>

              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-4">
                  {places.map((place) => (
                    <div
                      key={place.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-lg font-semibold">{place.name}</p>
                          <p className="text-zinc-400 text-sm">{place.category}</p>
                        </div>
                        <div className="bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-sm">
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
    <h2 className="text-3xl font-bold mb-6">
      Quest List
    </h2>

    <div className="space-y-4">
      {places.map((place) => (
        <div
          key={place.id}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-semibold">
                {place.name}
              </p>

              <p className="text-zinc-400 text-sm">
                {place.category}
              </p>
            </div>

            <div className="bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-sm">
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
    <h2 className="text-3xl font-bold mb-6">
      Adventure Map
    </h2>

    <DiscoveryMap discoveries={discoveries} />
  </section>
)}

{/* ----  Journal view  ------- */}
{activeView === 'journal' && (
  <section className="pb-24">
    <h2 className="text-3xl font-bold mb-6">
      Journal Timeline
    </h2>

    <div className="space-y-5">
      {discoveries.map((discovery) => (
        <div
          key={discovery.id}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
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

            <p className="text-sm text-zinc-400 mt-1">
              {getMemberName(discovery.members)} · {discovery.points} pts · {formatTimestamp(discovery.created_at)}
            </p>

            <button
              type="button"
              onClick={() => openEditDiscovery(discovery)}
              className="mt-3 text-sm text-yellow-400 font-semibold"
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

      {showCaptureForm && <CaptureModal />}
      {editingDiscovery && <EditModal />}
      <BottomNav />
    </main>
  )
}
