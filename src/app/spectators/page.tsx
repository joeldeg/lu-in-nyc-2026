'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import type { SpectatorDiscovery } from '@/components/SpectatorMap'

const SpectatorMap = dynamic(
  () => import('@/components/SpectatorMap'),
  { ssr: false }
)

const TRIP_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_MOMENT_GOAL = 60

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
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<SpectatorDiscovery | null>(null)
  const [focusDiscoveryId, setFocusDiscoveryId] = useState<string | null>(null)
  const [newMomentCount, setNewMomentCount] = useState(0)
  const [latestNewMoment, setLatestNewMoment] = useState<SpectatorDiscovery | null>(null)

  const totalPoints = discoveries.reduce((sum, item) => sum + item.points, 0)
  const mappedMoments = discoveries.filter(
    (discovery) => Number.isFinite(discovery.latitude) && Number.isFinite(discovery.longitude)
  )
  const progressPercent = Math.min(Math.round((discoveries.length / TEAM_MOMENT_GOAL) * 100), 100)

  const fetchDiscoveries = useCallback(async () => {
    const { data, error } = await supabase
      .from('discoveries')
      .select('id, photo_url, caption, latitude, longitude, points, created_at, members(name)')
      .eq('trip_id', TRIP_ID)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setDiscoveries((data ?? []) as SpectatorDiscovery[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchDiscoveries()
  }, [fetchDiscoveries])

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
            .select('id, photo_url, caption, latitude, longitude, points, created_at, members(name)')
            .eq('id', insertedId)
            .single()

          if (error || !data) {
            await fetchDiscoveries()
            return
          }

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
  }, [fetchDiscoveries])

  function focusLatestMoment() {
    if (!latestNewMoment) return

    setFocusDiscoveryId(latestNewMoment.id)
    window.setTimeout(() => setFocusDiscoveryId(null), 250)
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-zinc-950 p-5">
      <div className="mx-auto max-w-5xl pb-10">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-blue-700 text-white flex items-center justify-center text-xl font-black tracking-tight">
              NYC
            </div>
            <div>
              <p className="text-xs font-black uppercase text-blue-700">Live Spectator View</p>
              <h1 className="text-3xl font-black leading-none">Lu in NYC 2026</h1>
              <p className="mt-1 text-sm font-semibold text-zinc-500">
                Follow the team&apos;s day trip memories as they happen.
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
                onClick={focusLatestMoment}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white"
              >
                View latest
              </button>
            </div>
          </div>
        )}

        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">Adventure Map</h2>
              <p className="text-sm font-semibold text-zinc-500">
                {loading
                  ? 'Loading memories...'
                  : `${mappedMoments.length} mapped memories`}
              </p>
            </div>
          </div>

          <SpectatorMap
            discoveries={discoveries}
            focusDiscoveryId={focusDiscoveryId}
            onOpenImage={setSelectedImage}
          />
        </section>

      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[10000] bg-black/90 p-4 flex items-center justify-center">
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
