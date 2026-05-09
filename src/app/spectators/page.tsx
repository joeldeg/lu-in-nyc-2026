'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TRIP_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_MOMENT_GOAL = 60

type Place = {
  id: string
  name: string
  category: string
  points: number
  latitude: number | null
  longitude: number | null
}

type SpectatorDiscovery = {
  id: string
  place_id: string | null
  photo_url: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  points: number
  created_at: string
  members: { name: string } | { name: string }[] | null
}

const CATEGORY_STYLES: Record<string, { accent: string; badge: string }> = {
  Transit: { accent: 'border-blue-600', badge: 'bg-blue-100 text-blue-800' },
  Food: { accent: 'border-orange-500', badge: 'bg-orange-100 text-orange-800' },
  'Street Life': { accent: 'border-green-600', badge: 'bg-green-100 text-green-800' },
  'NYC Icons': { accent: 'border-yellow-500', badge: 'bg-yellow-100 text-yellow-900' },
  Shopping: { accent: 'border-purple-600', badge: 'bg-purple-100 text-purple-800' },
  'Team Bonus': { accent: 'border-pink-600', badge: 'bg-pink-100 text-pink-800' }
}

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? {
    accent: 'border-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700'
  }
}

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

export default function SpectatorsPage() {
  const [discoveries, setDiscoveries] = useState<SpectatorDiscovery[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<SpectatorDiscovery | null>(null)
  const [newMomentCount, setNewMomentCount] = useState(0)
  const [latestNewMoment, setLatestNewMoment] = useState<SpectatorDiscovery | null>(null)

  const totalPoints = discoveries.reduce((sum, item) => sum + item.points, 0)
  const progressPercent = Math.min(Math.round((discoveries.length / TEAM_MOMENT_GOAL) * 100), 100)
  const completedPlaceIds = new Set(discoveries.map((discovery) => discovery.place_id).filter(Boolean))
  const completedQuestCount = places.filter((place) => completedPlaceIds.has(place.id)).length
  const questCategories = Array.from(
    places.reduce((groups, place) => {
      const category = place.category || 'Other'
      const categoryPlaces = groups.get(category) ?? []
      categoryPlaces.push(place)
      groups.set(category, categoryPlaces)
      return groups
    }, new Map<string, Place[]>())
  ).map(([category, categoryPlaces]) => ({
    category,
    places: categoryPlaces
  }))

  useEffect(() => {
    async function loadPageData() {
      const [placesResponse, discoveriesResponse] = await Promise.all([
        supabase.from('places').select('*').order('category').order('name'),
        supabase
          .from('discoveries')
          .select('id, place_id, photo_url, caption, latitude, longitude, points, created_at, members(name)')
          .eq('trip_id', TRIP_ID)
          .order('created_at', { ascending: false })
      ])

      if (placesResponse.error) {
        console.error(placesResponse.error)
      } else {
        setPlaces((placesResponse.data ?? []) as Place[])
      }

      if (discoveriesResponse.error) {
        console.error(discoveriesResponse.error)
      } else {
        setDiscoveries((discoveriesResponse.data ?? []) as SpectatorDiscovery[])
      }

      setLoading(false)
    }

    void loadPageData()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('spectator-discoveries')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discoveries',
          filter: `trip_id=eq.${TRIP_ID}`
        },
        async (payload) => {
          const insertedId = payload.new.id
          if (!insertedId) return

          const { data, error } = await supabase
            .from('discoveries')
            .select('id, place_id, photo_url, caption, latitude, longitude, points, created_at, members(name)')
            .eq('id', insertedId)
            .single()

          if (error || !data) return

          const nextMoment = data as SpectatorDiscovery

          setDiscoveries((current) => {
            const withoutDuplicate = current.filter((item) => item.id !== nextMoment.id)
            return [nextMoment, ...withoutDuplicate]
          })
          setLatestNewMoment(nextMoment)
          setNewMomentCount((count) => count + 1)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#f7f3ea] p-5 text-zinc-950">
      <div className="mx-auto max-w-5xl pb-10">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 text-xl font-black tracking-tight text-white">
              NYC
            </div>
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Live Spectator View</p>
              <h1 className="text-3xl font-black leading-none">Lu in NYC 2026</h1>
              <p className="mt-1 text-sm font-semibold text-zinc-500">
                Follow the team&apos;s newest day trip memories as they happen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[24px] bg-zinc-950 p-3 text-white shadow-xl">
            <div className="px-3 text-center">
              <p className="text-2xl font-black text-yellow-400">{discoveries.length}</p>
              <p className="text-xs font-bold text-zinc-300">Moments</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-2xl font-black text-yellow-400">{totalPoints}</p>
              <p className="text-xs font-bold text-zinc-300">Points</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-2xl font-black text-yellow-400">{progressPercent}%</p>
              <p className="text-xs font-bold text-zinc-300">Goal</p>
            </div>
          </div>
        </header>

        {newMomentCount > 0 && latestNewMoment && (
          <div className="mb-5 rounded-2xl border border-yellow-300 bg-yellow-100 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold text-zinc-950">
                {newMomentCount === 1
                  ? 'New memory added!'
                  : `${newMomentCount} new moments added!`}
              </p>
              <button
                type="button"
                onClick={() => setSelectedImage(latestNewMoment)}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white"
              >
                Open latest
              </button>
            </div>
          </div>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Latest memories</p>
              <h2 className="text-2xl font-black">Captured Moments</h2>
              <p className="text-sm font-semibold text-zinc-500">
                {loading ? 'Loading memories...' : 'Newest moments appear first.'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-zinc-500">Loading memories...</p>
            </div>
          ) : discoveries.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="font-black text-zinc-950">No memories yet.</p>
              <p className="mt-1 text-sm font-semibold text-zinc-500">They will show up here as soon as the team adds them.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discoveries.map((discovery) => (
                <button
                  key={discovery.id}
                  type="button"
                  onClick={() => setSelectedImage(discovery)}
                  className={`overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${latestNewMoment?.id === discovery.id ? 'ring-4 ring-yellow-300' : ''}`}
                >
                  <img
                    src={discovery.photo_url}
                    alt={discovery.caption ?? 'NYC moment'}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="text-lg font-black leading-tight">{discovery.caption || 'NYC moment'}</h3>
                      <span className="shrink-0 rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-black text-yellow-400">
                        +{discovery.points}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-500">
                      {getMemberName(discovery.members)} · {formatTimestamp(discovery.created_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Quest progress</p>
              <h2 className="text-2xl font-black">Team Quest List</h2>
              <p className="text-sm font-semibold text-zinc-500">
                {completedQuestCount} of {places.length} quests completed
              </p>
            </div>
            <span className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-yellow-400">
              {places.length === 0 ? 0 : Math.round((completedQuestCount / places.length) * 100)}% complete
            </span>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-zinc-500">Loading quests...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questCategories.map(({ category, places: categoryPlaces }) => {
                const style = getCategoryStyle(category)
                const completedInCategory = categoryPlaces.filter((place) => completedPlaceIds.has(place.id)).length

                return (
                  <section key={category} className="rounded-3xl bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{category}</h3>
                        <p className="text-xs font-semibold text-zinc-500">
                          {completedInCategory} of {categoryPlaces.length} complete
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${style.badge}`}>
                        {categoryPlaces.reduce((sum, place) => sum + place.points, 0)} pts
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryPlaces.map((place) => {
                        const isComplete = completedPlaceIds.has(place.id)

                        return (
                          <div
                            key={place.id}
                            className={`flex items-center justify-between gap-3 rounded-2xl border border-l-4 bg-[#f7f3ea] px-3 py-2 ${isComplete ? 'border-green-500' : style.accent}`}
                          >
                            <p className={`text-sm font-black leading-tight ${isComplete ? 'text-zinc-950' : 'text-zinc-700'}`}>
                              {place.name}
                            </p>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${isComplete ? 'bg-green-100 text-green-800' : 'bg-white text-zinc-600'}`}>
                              {isComplete ? 'Done' : `${place.points} pts`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            aria-label="Close full screen image"
            onClick={() => setSelectedImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-2 text-2xl font-bold text-white"
          >
            ×
          </button>
          <div className="max-h-full max-w-5xl">
            <img
              src={selectedImage.photo_url}
              alt={selectedImage.caption ?? 'NYC moment'}
              className="max-h-[82vh] w-auto max-w-full rounded-3xl object-contain"
            />
            <div className="mt-4 text-center text-white">
              <p className="text-xl font-black">{selectedImage.caption || 'NYC moment'}</p>
              <p className="text-sm text-zinc-300">
                {getMemberName(selectedImage.members)} · {formatTimestamp(selectedImage.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
