import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import api, { errMsg, useAction } from '../api'
import Icon from './Icon'
import { Alert, Button, Loader } from './ui'
import { fmtDate, fmtMoney } from '../format'
import AuthForm from './AuthForm'
import { useConsumer } from './ConsumerContext'

// Secret QR codes are 6-32 letters/digits; anything else is not a scan link
export const CODE_RE = /^[A-Za-z0-9]{6,32}$/

// Headline for each scan result returned by POST /api/scan/:code
function heading(data) {
  switch (data.result) {
    case 'ok':
      return data.genuine
        ? { icon: 'shieldCheck', tone: 'green', title: 'Genuine product', text: 'This product is verified by the brand.' }
        : { icon: 'gift', tone: 'green', title: 'Valid code', text: 'This code is part of an active reward campaign.' }
    case 'not_active':
      return { icon: 'clock', tone: 'amber', title: 'Not active yet', text: `This code becomes active on ${fmtDate(data.activation_date)}.` }
    case 'expired':
      return { icon: 'clock', tone: 'gray', title: 'Code expired', text: `This code expired on ${fmtDate(data.expiry_date)}.` }
    case 'deleted':
      return { icon: 'shieldAlert', tone: 'red', title: 'Code no longer valid', text: 'This QR code has been cancelled by the brand.' }
    case 'unassigned':
      return { icon: 'alert', tone: 'amber', title: 'Code not activated', text: 'The brand has not activated this code yet.' }
    case 'invalid':
      return { icon: 'shieldAlert', tone: 'red', title: 'Code not recognised', text: 'We could not find this code. The product may not be genuine.' }
    default:
      return { icon: 'alert', tone: 'red', title: 'Something went wrong', text: data.message }
  }
}

function CashbackPanel({ code, cashback }) {
  const { consumer } = useConsumer()
  const [claimed, setClaimed] = useState(cashback.mine ? cashback.amount : null)
  const claim = useAction(async () => {
    const r = await api.post(`/scan/${encodeURIComponent(code)}/claim`)
    setClaimed(r.data.amount)
  })

  if (claimed != null) {
    return (
      <div className="m-reward ok">
        <span className="m-reward-icon"><Icon name="checkCircle" size={26} /></span>
        <small>Added to your wallet</small>
        <div className="m-reward-amount">{fmtMoney(claimed)}</div>
        <Link to="/wallet" className="btn btn-secondary btn-block">View wallet</Link>
      </div>
    )
  }
  if (cashback.redeemed) return <Alert type="warning">The cashback on this code has already been claimed.</Alert>

  return (
    <div className="stack">
      <div className="m-reward">
        <span className="m-reward-icon"><Icon name="gift" size={26} /></span>
        <small>You've won cashback</small>
        <div className="m-reward-amount">{fmtMoney(cashback.amount)}</div>
      </div>
      <Alert>{claim.error}</Alert>
      {consumer ? (
        <Button size="lg" icon="wallet" className="btn-block" loading={claim.loading} onClick={() => claim.run()}>
          Claim {fmtMoney(cashback.amount)} to wallet
        </Button>
      ) : consumer === null && (
        <div className="m-inline-auth">
          <p className="m-inline-auth-title">Log in or sign up to claim your cashback</p>
          {/* Claim straight after logging in, so the customer doesn't have to scan again */}
          <AuthForm onAuthed={() => claim.run()} />
        </div>
      )}
    </div>
  )
}

// One scan result: product verification, cashback, or both depending on the QR's program
export default function ScanResult({ inApp }) {
  const { code } = useParams()
  const [data, setData] = useState(null)
  const started = useRef(false)

  // Each page load counts as one scan; the ref stops StrictMode from scanning twice
  useEffect(() => {
    if (started.current || !CODE_RE.test(code)) return
    started.current = true
    api.post(`/scan/${encodeURIComponent(code)}`)
      .then((r) => setData(r.data))
      .catch((e) => setData({ result: 'error', message: errMsg(e) }))
  }, [code])

  if (!CODE_RE.test(code)) return <Navigate to="/" replace />
  if (!data) return <Loader />
  const h = heading(data)

  return (
    <div className="m-stack">
      <section className="m-card m-result">
        {data.brand && (
          <div className="m-result-brand">
            {data.brand.logo && <img src={data.brand.logo} alt="" />}
            <span>{data.brand.name}</span>
          </div>
        )}
        <div className={`m-result-badge tone-${h.tone}`}><Icon name={h.icon} size={38} /></div>
        <h1>{h.title}</h1>
        <p>{h.text}</p>
      </section>

      {data.product && (
        <section className="m-card">
          <div className="m-product">
            <span className="m-product-avatar">{data.product.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <h2>{data.product.name}</h2>
              <p>{data.campaign}</p>
            </div>
          </div>
          <dl className="m-dl">
            <dt>QR ID</dt><dd className="qr-id">{data.display_id}</dd>
            {data.product.sku && <><dt>SKU</dt><dd>{data.product.sku}</dd></>}
            {data.product.category && <><dt>Category</dt><dd>{data.product.category}</dd></>}
            <dt>Valid till</dt><dd>{fmtDate(data.expiry_date)}</dd>
          </dl>
          {data.product.description && <p className="m-desc">{data.product.description}</p>}
          {data.product.about && <p className="m-desc">{data.product.about}</p>}
        </section>
      )}

      {data.verification?.length > 0 && (
        <section className="m-card">
          <h2 className="m-card-title"><Icon name="checkCircle" size={18} />Check these match your pack</h2>
          <dl className="m-dl">
            {data.verification.map((d) => (
              <Fragment key={d.key}><dt>{d.label}</dt><dd>{d.type === 'date' ? fmtDate(d.value) : d.value}</dd></Fragment>
            ))}
          </dl>
          <p className="m-desc">If anything printed on the pack is different, the product may not be genuine.</p>
        </section>
      )}

      {data.result === 'ok' && data.genuine && data.scan_count > 1 && !data.cashback?.mine && (
        <Alert type="warning">
          This code has been scanned {data.scan_count} times. If this is your first scan, the product may be a copy.
        </Alert>
      )}

      {data.cashback && <section className="m-card"><CashbackPanel code={code} cashback={data.cashback} /></section>}

      {inApp && <Link to="/scan" className="btn btn-secondary btn-lg btn-block"><Icon name="scan" size={18} />Scan another code</Link>}
    </div>
  )
}
