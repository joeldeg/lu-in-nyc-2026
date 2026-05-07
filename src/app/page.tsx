'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Place = {
  id: string
  name: string
  category: string
  points: number
}

export default function HomePage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlaces() {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .order('created_at')

      if (error) {
        console.error(error)
      } else {
        setPlaces(data)
      }

      setLoading(false)
    }

    fetchPlaces()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-md mx-auto">

        <div className="mb-8">
          <p className="text-yellow-400 uppercase tracking-widest text-sm">
            NYC Weekend Adventure
          </p>

          <h1 className="text-4xl font-bold mt-2">
            Lu in NYC 2026
          </h1>

          <p className="text-zinc-400 mt-2">
            Cheese It 📸
          </p>
        </div>

        <button className="w-full bg-yellow-400 text-black font-bold py-4 rounded-2xl text-lg mb-8 hover:scale-[1.02] transition">
          📸 Cheese It
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            Planned Places
          </h2>

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
          )}
        </div>

      </div>
    </main>
  )
}