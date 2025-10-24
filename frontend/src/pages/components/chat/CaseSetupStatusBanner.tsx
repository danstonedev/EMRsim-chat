type CaseSetupStatusBannerProps = {
  backendOk: boolean | null
  personasCount: number
}

export function CaseSetupStatusBanner({ backendOk, personasCount }: CaseSetupStatusBannerProps) {
  return (
    <div className="case-setup-inline__status" aria-live="polite">
      {backendOk === false && (
        <div className="banner banner--error">
          Backend not reachable at {import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}
        </div>
      )}
      {backendOk && personasCount === 0 && <div className="banner banner--warn">No SPS personas available.</div>}
    </div>
  )
}
