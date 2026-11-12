import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFetch } from '../api'
import Icon from '../components/Icon'
import { Alert, Button, Loader } from '../components/ui'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../format'
import AuthForm from '../components/AuthForm'
import { useConsumer } from '../components/ConsumerContext'
import MobileBrand from '../components/MobileBrand'
import { CODE_RE } from '../components/ScanResult'

// ---------- Login / sign up ----------

export function AppAuth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Only follow same-site paths ("/wallet"), never "//other-site"
  const raw = params.get('next') || ''
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  return (
    <div className="m-app m-auth">
      <div className="m-auth-hero">
        <MobileBrand />
        <h1>Scan. Verify.<br />Get rewarded.</h1>
        <p>Check that your product is genuine and collect cashback with every scan.</p>
      </div>
      <div className="m-card m-auth-card">
        <AuthForm onAuthed={() => navigate(next, { replace: true })} />
      </div>
    </div>
  )
}

// ---------- Shared bits ----------

function WalletCard({ wallet }) {
  return (
    <Link to="/wallet" className="m-wallet">
      <span className="m-wallet-label"><Icon name="wallet" size={16} />Cashback balance</span>
      <span className="m-wallet-amount">{fmtMoney(wallet?.balance)}</span>
      <span className="m-wallet-meta">{fmtNum(wallet?.claimed)} rewards claimed · {fmtNum(wallet?.scans)} products scanned</span>
    </Link>
  )
}

const RESULT_TAG = {
  not_active: { label: 'Not active yet', tone: 'amber' },
  expired: { label: 'Expired', tone: 'gray' },
  unassigned: { label: 'Not activated', tone: 'amber' },
  deleted: { label: 'No longer valid', tone: 'red' },
}

function ActivityItem({ item }) {
  const tag = item.result !== 'ok' ? RESULT_TAG[item.result]
    : item.claimed_by_me ? { label: `+${fmtMoney(item.cashback_amount)}`, tone: 'green' }
    : item.program === 'verification' ? { label: 'Genuine', tone: 'blue' }
    : item.redeemed ? { label: 'Claimed by someone else', tone: 'gray' }
    : { label: 'Cashback not claimed', tone: 'amber' }
  return (
    <li className="m-activity">
      <span className={`m-activity-icon tone-${item.cashback_amount && item.result === 'ok' ? 'green' : 'blue'}`}>
        <Icon name={item.cashback_amount && item.result === 'ok' ? 'gift' : 'shieldCheck'} size={18} />
      </span>
      <div className="min-w-0">
        <div className="m-activity-title">{item.product_name}</div>
        <div className="m-activity-sub"><span className="qr-id">{item.display_id}</span> · {fmtDateTime(item.created_at)}</div>
      </div>
      <span className={`badge tone-${tag.tone}`}>{tag.label}</span>
    </li>
  )
}

function ActivityList({ items }) {
  if (!items.length) {
    return (
      <div className="m-empty">
        <Icon name="scan" size={28} />
        <p>No scans yet. Scan a product's QR code to verify it and collect cashback.</p>
      </div>
    )
  }
  return <ul className="m-activity-list">{items.map((i) => <ActivityItem key={i.id} item={i} />)}</ul>
}

// ---------- Home ----------

export function AppHome() {
  const { consumer } = useConsumer()
  const { data: wallet, error } = useFetch('/app/wallet')
  return (
    <div className="m-stack">
      <div>
        <p className="m-greet-sub">Welcome back,</p>
        <h1 className="m-greet">{consumer.name.split(' ')[0]}</h1>
      </div>
      <WalletCard wallet={wallet} />
      <Link to="/scan" className="m-scan-cta">
        <span className="m-scan-cta-icon"><Icon name="scan" size={30} /></span>
        <span>
          <b>Scan a QR code</b>
          <small>Verify a product or claim cashback</small>
        </span>
        <Icon name="arrowRight" size={20} />
      </Link>
      <div className="m-steps">
        {[['scan', 'Scan'], ['shieldCheck', 'Verify'], ['gift', 'Earn']].map(([icon, label], i) => (
          <div key={label} className="m-step"><span><Icon name={icon} size={18} /></span>{i + 1}. {label}</div>
        ))}
      </div>
      <section>
        <div className="m-section-head"><h2>Recent activity</h2><Link to="/history">See all</Link></div>
        {error ? <Alert>{error}</Alert> : !wallet ? <Loader /> : <ActivityList items={wallet.history.slice(0, 4)} />}
      </section>
    </div>
  )
}

// ---------- Scanner ----------

// The camera library is large, so it's only downloaded when the scanner is opened
const loadScanner = () => import('html5-qrcode').then((m) => m.Html5Qrcode)

// QR text is a link like https://infisetu.com/<code>; take the last path segment
function extractCode(text) {
  let candidate = text.trim()
  try { candidate = new URL(candidate).pathname.split('/').filter(Boolean).pop() || '' } catch { /* not a URL: use as-is */ }
  return CODE_RE.test(candidate) ? candidate.toUpperCase() : null
}

export function AppScanner() {
  const navigate = useNavigate()
  const host = useRef(null)
  const [status, setStatus] = useState('starting') // starting | scanning | blocked
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)

  const found = (text) => {
    const code = extractCode(text)
    if (!code) { setError('This is not a TrustScan QR code.'); return false }
    navigate(`/result/${code}`)
    return true
  }

  // Live camera. A fresh element per mount keeps StrictMode's double-mount from stacking two video streams.
  useEffect(() => {
    const el = document.createElement('div')
    el.id = `qr-reader-${Math.random().toString(36).slice(2)}`
    host.current.appendChild(el)
    let done = false
    const started = loadScanner().then((Html5Qrcode) => {
      if (done) return null
      const scanner = new Html5Qrcode(el.id, { verbose: false })
      return scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s } } },
        (text) => { if (!done && found(text)) done = true },
        () => {}
      ).then(() => { setStatus('scanning'); return scanner })
    }).catch(() => { setStatus('blocked'); return null })
    return () => {
      done = true
      started.then((scanner) => (scanner?.isScanning ? scanner.stop() : null)).catch(() => {}).finally(() => el.remove())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback when the camera isn't available: read the QR from a photo
  const readPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setReading(true)
    const el = document.createElement('div')
    el.id = `qr-file-${Math.random().toString(36).slice(2)}`
    el.hidden = true
    document.body.appendChild(el)
    try {
      const Html5Qrcode = await loadScanner()
      found(await new Html5Qrcode(el.id, { verbose: false }).scanFile(file, false))
    } catch {
      setError('No QR code found in that photo. Try again with the code in focus.')
    } finally {
      el.remove()
      setReading(false)
    }
  }

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-title">Scan QR code</h1>
        <p className="m-subtitle">Point your camera at the QR code on the product.</p>
      </div>
      <div className="m-camera">
        <div ref={host} className="m-camera-feed" />
        {status === 'starting' && <div className="m-camera-overlay"><span className="spinner lg" /><p>Starting camera…</p></div>}
        {status === 'blocked' && (
          <div className="m-camera-overlay">
            <Icon name="alert" size={28} />
            <p>Camera unavailable. Allow camera access, or upload a photo of the QR code below.</p>
          </div>
        )}
      </div>
      <Alert>{error}</Alert>
      <label className={`btn btn-secondary btn-lg btn-block ${reading ? 'disabled' : ''}`}>
        {reading ? <span className="spinner" /> : <Icon name="download" size={18} />}
        Upload a photo of the QR
        <input type="file" accept="image/*" hidden onChange={readPhoto} disabled={reading} />
      </label>
    </div>
  )
}

// ---------- Wallet / history ----------

export function AppWallet({ historyOnly }) {
  const { data: wallet, error } = useFetch('/app/wallet')
  if (error) return <Alert>{error}</Alert>
  if (!wallet) return <Loader />
  return (
    <div className="m-stack">
      <h1 className="m-title">{historyOnly ? 'Scan history' : 'Wallet'}</h1>
      {!historyOnly && (
        <>
          <WalletCard wallet={wallet} />
          <Alert type="info">Cashback is credited to your registered mobile number. Payouts will appear here once enabled.</Alert>
        </>
      )}
      <section>
        {!historyOnly && <div className="m-section-head"><h2>All activity</h2></div>}
        <ActivityList items={wallet.history} />
      </section>
    </div>
  )
}

// ---------- Profile ----------

export function AppProfile() {
  const { consumer, logout } = useConsumer()
  const navigate = useNavigate()
  const rows = [
    ['Name', consumer.name],
    ['Mobile', `+91 ${consumer.mobile}`],
    ['Email', consumer.email || '—'],
    ['Member since', fmtDate(consumer.created_at)],
  ]
  return (
    <div className="m-stack">
      <section className="m-card m-profile">
        <span className="m-avatar">{consumer.name[0].toUpperCase()}</span>
        <h1>{consumer.name}</h1>
        <p>+91 {consumer.mobile}</p>
      </section>
      <section className="m-card">
        <dl className="m-dl">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      </section>
      <Button variant="secondary" size="lg" icon="logout" className="btn-block"
        onClick={async () => { await logout(); navigate('/login', { replace: true }) }}>
        Log out
      </Button>
    </div>
  )
}
