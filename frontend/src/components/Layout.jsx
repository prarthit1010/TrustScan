import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useFetch } from '../api'
import Icon from './Icon'

const NAV = [
  { to: '/', label: 'Overview', icon: 'grid', end: true },
  { to: '/products', label: 'Products', icon: 'box' },
  { to: '/campaigns', label: 'Campaigns', icon: 'campaign' },
  { to: '/qr-generation', label: 'QR Generation', icon: 'qr' },
  { to: '/assign', label: 'Assign Program', icon: 'assign' },
  { to: '/qr-codes', label: 'QR Details', icon: 'list' },
]
const ACCOUNT_NAV = [{ to: '/settings', label: 'Settings', icon: 'settings' }]

const navLinks = (items) => items.map((n) => (
  <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
    <Icon name={n.icon} />
    <span>{n.label}</span>
  </NavLink>
))

// name / logo come from Settings once logged in; the login page shows the default
export function Brand({ name = 'TrustScan', logo }) {
  return (
    <div className="brand">
      {logo
        ? <img className="brand-logo" src={logo} alt="" />
        : <span className="brand-mark"><Icon name="shieldCheck" size={18} /></span>}
      <span className="brand-name">{name}</span>
    </div>
  )
}

export default function Layout({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { data: settings, reload: reloadSettings } = useFetch('/settings')
  const brand = <Brand name={settings?.app_name} logo={settings?.logo} />
  useEffect(() => { if (settings) document.title = settings.app_name }, [settings])
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {brand}
        <div className="nav-section">Campaign setup</div>
        <nav className="nav">{navLinks(NAV)}</nav>
        <div className="nav-section nav-section-gap">Account</div>
        <nav className="nav">{navLinks(ACCOUNT_NAV)}</nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.email[0].toUpperCase()}</div>
          <div className="user-meta">
            <span className="user-email" title={user.email}>{user.email}</span>
            <span>Brand admin</span>
          </div>
          <button type="button" className="btn-icon dark" onClick={onLogout} title="Log out" aria-label="Log out">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button type="button" className="btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          {brand}
        </header>
        <main className="page"><Outlet context={{ settings, reloadSettings }} /></main>
      </div>
    </div>
  )
}
