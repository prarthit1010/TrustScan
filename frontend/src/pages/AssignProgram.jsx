import { useState } from 'react'
import { useFetch } from '../api'
import Icon from '../components/Icon'
import { Alert, Badge, Button, ButtonLink, Card, Drawer, EmptyState, Loader, PageHeader, Progress, StatCard } from '../components/ui'
import { batchLabel, fmtDate, fmtDateTime, fmtMoney, fmtNum, pct, PROGRAMS } from '../format'

const FILTERS = [{ key: 'all', label: 'All' }, ...Object.entries(PROGRAMS).map(([key, p]) => ({ key, label: p.label }))]

export default function AssignProgram() {
  const { data: batches } = useFetch('/batches')
  const { data: history, error } = useFetch('/assignments')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  const noBatches = batches && !batches.length
  const addButton = <ButtonLink to="/assign/new" icon="assign">Assign program</ButtonLink>
  const rows = history?.filter((a) => filter === 'all' || a.program === filter) ?? []

  const totals = (history ?? []).reduce((t, a) => ({
    codes: t.codes + a.qr_count,
    scanned: t.scanned + (a.scanned ?? 0),
    budget: t.budget + (a.total_cashback ?? 0),
    paid: t.paid + (a.cashback_paid ?? 0),
  }), { codes: 0, scanned: 0, budget: 0, paid: 0 })

  return (
    <>
      <PageHeader title="Assign Program"
        subtitle="Activate QR codes for verification, cashback or both. Codes are picked in serial order from the batch."
        actions={!noBatches && addButton} />

      <div className="stack-lg">
      {history?.length > 0 && (
        <div className="grid grid-4">
          <StatCard icon="assign" label="Assignments" value={fmtNum(history.length)} sub="Programs activated so far" />
          <StatCard icon="qr" tone="blue" label="Codes assigned" value={fmtNum(totals.codes)} sub="Across all batches" />
          <StatCard icon="scan" tone="violet" label="Codes scanned" value={fmtNum(totals.scanned)}
            sub={`${pct(totals.scanned, totals.codes)}% of assigned codes`} />
          <StatCard icon="wallet" tone="green" label="Cashback paid" value={fmtMoney(totals.paid)}
            sub={`of ${fmtMoney(totals.budget)} committed`} />
        </div>
      )}

      <Card title="Assignment history" subtitle="Click a row to see all its details." flush
        actions={history?.length > 0 && (
          <div className="seg">
            {FILTERS.map((f) => {
              const count = f.key === 'all' ? history.length : history.filter((a) => a.program === f.key).length
              return (
                <button key={f.key} type="button" className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
                  {f.label} <span className="seg-count">{count}</span>
                </button>
              )
            })}
          </div>
        )}>
        {error ? <div className="card-body"><Alert>{error}</Alert></div>
          : !history || !batches ? <Loader />
          : noBatches ? <EmptyState icon="qr" title="Generate QR codes first" text="Programs are assigned to codes inside a QR batch."
            action={<ButtonLink to="/qr-generation/new" icon="qr">Generate QR codes</ButtonLink>} />
          : !history.length ? <EmptyState icon="assign" title="Nothing assigned yet" text="Assign a program to activate your QR codes." action={addButton} />
          : !rows.length ? <EmptyState icon="list" title="No assignments here" text="No assignments match this program filter." />
          : (
            <div className="table-wrap">
              <table className="table history-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Program</th>
                    <th>QR code range</th>
                    <th>Scanned</th>
                    <th className="end">Cashback</th>
                    <th aria-label="Details" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <HistoryRow key={a.id} a={a} selected={open?.id === a.id} onOpen={() => setOpen(a)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      </div>
      <DetailsDrawer a={open} onClose={() => setOpen(null)} />
    </>
  )
}

function HistoryRow({ a, selected, onOpen }) {
  const program = PROGRAMS[a.program]
  const scanned = a.scanned ?? 0
  return (
    <tr className={`history-row ${selected ? 'selected' : ''}`} onClick={onOpen}>
      <td>
        <div className="cell-title">{batchLabel(a)}</div>
        <div className="cell-sub" title={a.campaign_name}>{a.campaign_name}</div>
      </td>
      <td><Badge tone={program.tone}>{program.label}</Badge></td>
      <td>
        {a.first_code
          ? <div className="code-range">{a.first_code}{a.last_code !== a.first_code && <><Icon name="arrowRight" size={13} />{a.last_code}</>}</div>
          : <span className="subtle">—</span>}
        <div className="cell-sub">{fmtNum(a.qr_count)} codes</div>
      </td>
      <td className="scan-cell">
        <div className="scan-top"><span className="num">{fmtNum(scanned)} / {fmtNum(a.qr_count)}</span><span className="subtle">{pct(scanned, a.qr_count)}%</span></div>
        <Progress value={pct(scanned, a.qr_count)} />
      </td>
      <td className="end">
        {a.total_cashback
          ? <><div className="cell-title num">{fmtMoney(a.total_cashback)}</div><div className="cell-sub">{fmtMoney(a.cashback_paid ?? 0)} paid</div></>
          : <span className="subtle">—</span>}
      </td>
      <td className="end">
        <button type="button" className="expand-btn" aria-label="View details">
          <Icon name="chevronRight" size={16} />
        </button>
      </td>
    </tr>
  )
}

function DetailsDrawer({ a, onClose }) {
  if (!a) return null
  const program = PROGRAMS[a.program]
  const scanned = a.scanned ?? 0
  const scannedPct = pct(scanned, a.qr_count)
  const hasDetails = a.verification_details?.length > 0
  const hasTiers = a.tiers?.length > 0
  const total = a.total_cashback ?? 0
  const paid = a.cashback_paid ?? 0
  const redeemed = a.redeemed ?? 0
  const singleCode = a.first_code && a.last_code === a.first_code

  return (
    <Drawer open onClose={onClose} width={500} className={`ad accent-${program.tone}`}
      title={batchLabel(a)}
      subtitle={<><span className="ad-program">{program.label}</span>{a.campaign_name}{a.product_name && ` · ${a.product_name}`}</>}
      footer={<>
        <span className="ad-footnote">Assigned {fmtDateTime(a.created_at)}</span>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </>}>

      <section className="ad-summary">
        <div className="ad-big">
          <span className="ad-big-num num">{scannedPct}<small>%</small></span>
          <span className="ad-big-label">of codes scanned</span>
        </div>
        <div className="ad-bar"><span style={{ width: `${Math.min(scannedPct, 100)}%` }} /></div>
        <dl className="ad-figures">
          <div><dt>Codes</dt><dd className="num">{fmtNum(a.qr_count)}</dd></div>
          <div><dt>Scanned</dt><dd className="num">{fmtNum(scanned)}</dd></div>
          {hasTiers
            ? <div><dt>Redeemed</dt><dd className="num">{fmtNum(redeemed)}</dd></div>
            : <div><dt>Remaining</dt><dd className="num">{fmtNum(Math.max(a.qr_count - scanned, 0))}</dd></div>}
        </dl>
      </section>

      <section className="ad-section">
        <h4>QR codes</h4>
        <dl className="ad-rows">
          <div>
            <dt>{singleCode ? 'Code' : 'Range'}</dt>
            <dd className="ad-mono">
              {!a.first_code ? '—' : singleCode ? a.first_code : <>{a.first_code}<span className="ad-dash">–</span>{a.last_code}</>}
            </dd>
          </div>
          <div><dt>Quantity</dt><dd className="num">{fmtNum(a.qr_count)} codes</dd></div>
          <div><dt>Order</dt><dd>Serial, from the batch</dd></div>
        </dl>
      </section>

      {hasDetails && (
        <section className="ad-section">
          <h4>Verification details</h4>
          <dl className="ad-rows">
            {a.verification_details.map((d) => (
              <div key={d.key}><dt>{d.label}</dt><dd>{d.type === 'date' ? fmtDate(d.value) : (d.value || '—')}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {hasTiers && (
        <section className="ad-section">
          <div className="ad-section-head">
            <h4>Cashback</h4>
            <span className="num"><b>{fmtMoney(paid)}</b> paid of {fmtMoney(total)}</span>
          </div>
          <div className="ad-bar ad-bar-green"><span style={{ width: `${Math.min(pct(paid, total), 100)}%` }} /></div>
          <table className="ad-tiers">
            <thead><tr><th>Reward</th><th>Codes</th><th>Amount</th></tr></thead>
            <tbody>
              {a.tiers.map((t, i) => (
                <tr key={i}>
                  <td className="num">{fmtMoney(t.amount)}</td>
                  <td className="num">{fmtNum(t.count)}</td>
                  <td className="num">{fmtMoney(t.count * t.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{fmtNum(a.tiers.reduce((s, t) => s + t.count, 0))}</td>
                <td className="num">{fmtMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="ad-footnote">
            Reward amounts are shuffled at random across the codes. {fmtMoney(Math.max(total - paid, 0))} is still to be claimed.
          </p>
        </section>
      )}
    </Drawer>
  )
}
