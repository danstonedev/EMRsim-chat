import ChatInterface from '@/components/ChatInterface'

// Server component: this value will be captured at build time in static sites,
// effectively reflecting the last deployment time. On dynamic renders, it
// reflects the render time.
function formatLastUpdated(d: Date): string {
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch {
    return d.toISOString()
  }
}

export default function Home() {
  const lastUpdated = formatLastUpdated(new Date())
  return (
    <>
      <ChatInterface />
      {/* Bottom-right "Last Updated" stamp */}
      <div
        className="fixed right-3 bottom-2 text-xs opacity-60 z-50 pointer-events-none select-none"
        aria-hidden
      >
        Last updated: {lastUpdated}
      </div>
    </>
  )
}
