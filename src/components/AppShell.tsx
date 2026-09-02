import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PlusIcon } from './Icons'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="wordmark" to="/" aria-label="TIER 홈">
            <span className="wordmark__rule" />
            TIER
          </Link>
          <nav className="site-nav" aria-label="주요 메뉴">
            <NavLink
              className={({ isActive }) =>
                `site-nav__link${isActive ? ' is-active' : ''}`
              }
              to="/"
              end
            >
              둘러보기
            </NavLink>
            <Link className="button button--ink button--compact" to="/new">
              <PlusIcon />
              새 티어표
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div>
          <strong>TIER</strong>
          <span>좋아하는 것들을 내 기준대로.</span>
        </div>
        <p>직접 만든 기준은, 생각보다 오래 남습니다.</p>
      </footer>
    </div>
  )
}
