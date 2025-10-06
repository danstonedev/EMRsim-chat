export function MessageSkeleton() {
  return (
    <div className="message message--assistant message--skeleton">
      <div className="message__bubble message__bubble--skeleton">
        <div className="skeleton-line skeleton-line--80" />
        <div className="skeleton-line skeleton-line--60" />
      </div>
    </div>
  )
}
