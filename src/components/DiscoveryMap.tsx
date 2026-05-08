'use client'

type Discovery = {
  id: string
  photo_url: string
  created_at: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  members:
  | {
      name: string
    }
  | {
      name: string
    }[]
  | null
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function getMemberName(
  memberData:
    | { name: string }
    | { name: string }[]
    | null
) {
  if (!memberData) return 'Someone'

  if (Array.isArray(memberData)) {
    return memberData[0]?.name ?? 'Someone'
  }

  return memberData.name ?? 'Someone'
}

export default function DiscoveryMap({
  discoveries
}: {
  discoveries: Discovery[]
}) {
  const mappedDiscoveries = discoveries.filter(
    (d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
  )

  if (mappedDiscoveries.length === 0) {
    return (
      <div className="min-h-56 w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-center text-center">
        <p className="text-sm text-zinc-400">
          Saved moments with location will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900">
      <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
        {mappedDiscoveries.map((discovery) => {
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${discovery.latitude},${discovery.longitude}`

          return (
            <a
              key={discovery.id}
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 p-3 hover:bg-zinc-800"
            >
              <img
                src={discovery.photo_url}
                alt={discovery.caption ?? 'NYC moment'}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover"
              />

              <div className="min-w-0">
                <p className="font-semibold">
                  {discovery.caption || 'NYC Moment'}
                </p>
                <p className="text-sm text-zinc-400">
                  {getMemberName(discovery.members)} · {formatTimestamp(discovery.created_at)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {discovery.latitude?.toFixed(5)}, {discovery.longitude?.toFixed(5)}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
