import { BUILD_TIME, GIT_SHA, GIT_BRANCH } from './buildInfo'
import '../styles/build-badge.css'

export default function BuildBadge() {
  const date = new Date(BUILD_TIME)
  const pretty = isNaN(date.getTime()) ? BUILD_TIME : date.toLocaleString()

  return (
    <div className="build-badge" aria-label="Build information">
      <div>Last updated: {pretty}</div>
      <div>
        Commit: <code>{GIT_SHA}</code>
        {GIT_BRANCH ? (
          <span>
            {' '}
            on <code>{GIT_BRANCH}</code>
          </span>
        ) : null}
      </div>
    </div>
  )
}
