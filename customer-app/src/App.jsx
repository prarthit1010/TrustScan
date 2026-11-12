import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ConsumerProvider, useConsumer } from './components/ConsumerContext'
import Icon from './components/Icon'
import MobileBrand from './components/MobileBrand'
import ScanResult from './components/ScanResult'
import { Loader } from './components/ui'
import { AppAuth, AppHome, AppProfile, AppScanner, AppWallet } from './pages'

const TABS = [
  { to: '/', label: 'Home', icon: 'grid', end: true },
  { to: '/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/scan', label: 'Scan', icon: 'scan', primary: true },
  { to: '/history', label: 'History', icon: 'list' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

// Phone-sized frame with a top bar and bottom tab bar
function MobileShell() {
  return (
    <div className="m-app">
      <header className="m-topbar"><MobileBrand /></header>
      <main className="m-main"><Outlet /></main>
      <nav className="m-tabbar" aria-label="App">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `m-tab ${t.primary ? 'primary' : ''} ${isActive ? 'active' : ''}`}>
            <span className="m-tab-icon"><Icon name={t.icon} size={t.primary ? 24 : 20} /></span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function RequireConsumer({ children }) {
  const { consumer } = useConsumer()
  const { pathname } = useLocation()
  if (consumer === undefined) return <div className="m-app"><Loader /></div>
  if (!consumer) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />
  return children
}

function GuestOnly({ children }) {
  const { consumer } = useConsumer()
  if (consumer === undefined) return <div className="m-app"><Loader /></div>
  return consumer ? <Navigate to="/" replace /> : children
}

// Opened from a QR link (<QR_BASE_URL>/<code>) by any phone camera; works without logging in
function PublicScan() {
  return (
    <div className="m-app">
      <header className="m-topbar"><MobileBrand /><Link to="/" className="m-topbar-link">Open app</Link></header>
      <main className="m-main"><ScanResult /></main>
    </div>
  )
}

export default function App() {
  return (
    <ConsumerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><AppAuth /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><AppAuth /></GuestOnly>} />
          <Route element={<RequireConsumer><MobileShell /></RequireConsumer>}>
            <Route index element={<AppHome />} />
            <Route path="/scan" element={<AppScanner />} />
            <Route path="/wallet" element={<AppWallet />} />
            <Route path="/history" element={<AppWallet historyOnly />} />
            <Route path="/profile" element={<AppProfile />} />
            <Route path="/result/:code" element={<ScanResult inApp />} />
          </Route>
          {/* QR links: static paths above always win over /:code */}
          <Route path="/:code" element={<PublicScan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConsumerProvider>
  )
}
