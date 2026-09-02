import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="wordmark" to="/" aria-label="TIER 홈">
            TIER
          </Link>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
