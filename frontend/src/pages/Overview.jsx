import { Link } from 'react-router-dom'
import { useFetch } from '../api'
import Icon from '../components/Icon'
import { CellTitle, DataTable } from '../components/table'
import { Alert, Badge, ButtonLink, Card, EmptyState, Loader, PageHeader, Progress, StatCard } from '../components/ui'
import { CAMPAIGN_STATUS, fmtDate, fmtMoney, fmtNum, pct } from '../format'

const MIX = [
  { key: 'verification', label: 'Verification', color: 'var(--info)' },
  { key: 'cashback', label: 'Cashback', color: 'var(--success)' },
  { key: 'both', label: 'Verification + Cashback', color: 'var(--violet)' },
  { key: 'unassigned', label: 'Not assigned yet', color: '#cbd5e1' },
]

const RECENT_COLUMNS = [
  { key: 'name', header: 'Campaign', render: (c) => <CellTitle title={c.name} sub={c.product_name} /> },
  { key: 'runs', header: 'Runs', render: (c) => <span className="subtle nowrap">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span> },
  { key: 'status', header: 'Status', render: (c) => <Badge tone={CAMPAIGN_STATUS[c.status].tone} dot>{CAMPAIGN_STATUS[c.status].label}</Badge> },
  { key: 'qr_count', header: 'QR codes', align: 'end', render: (c) => fmtNum(c.qr_count) },
]

export default function Overview() {
  const { data, error } = useFetch('/stats')
  if (error) return <Alert>{error}</Alert>
  if (!data) return <Loader />
  const { counts, qr, recent } = data

  const steps = [
    { title: 'Create a product', text: 'The item your campaign promotes', done: counts.products > 0, to: '/products' },
    { title: 'Set up a campaign', text: 'Name, product and run dates', done: counts.campaigns > 0, to: '/campaigns' },
    { title: 'Generate QR codes', text: 'Quantity, activation and expiry', done: qr.total > 0, to: '/qr-generation' },
    { title: 'Assign programs', text: 'Verification, cashback or both', done: qr.total - qr.unassigned > 0, to: '/assign' },
    { title: 'Track QR details', text: 'Scans, validity and claims', done: qr.scanned > 0, to: '/qr-codes' },
  ]
  const next = steps.find((s) => !s.done)

  return (
    <div className="stack-lg">
      <PageHeader title="Overview" subtitle="Your campaign pipeline at a glance."
        actions={next && <ButtonLink to={next.to} icon="arrowRight">Next: {next.title}</ButtonLink>} />

      <div className="grid grid-4">
        <StatCard icon="campaign" label="Active campaigns" value={fmtNum(counts.active_campaigns)}
          sub={`${fmtNum(counts.campaigns)} total · ${fmtNum(counts.products)} products`} />
        <StatCard icon="qr" tone="blue" label="QR codes generated" value={fmtNum(qr.total)}
          sub={`${fmtNum(qr.unassigned)} waiting for a program`} />
        <StatCard icon="scan" tone="violet" label="Codes scanned" value={fmtNum(qr.scanned)}
          sub={`${pct(qr.scanned, qr.total)}% of all codes`} />
        <StatCard icon="wallet" tone="green" label="Cashback claimed" value={fmtMoney(qr.cashback_redeemed)}
          sub={`of ${fmtMoney(qr.cashback_allocated)} allocated`} />
      </div>

      <Card title="Campaign setup flow" subtitle="Complete each step to launch a campaign.">
        <div className="flow">
          {steps.map((s, i) => (
            <Link key={s.to} to={s.to} className={`flow-step ${s.done ? 'done' : ''} ${s === next ? 'current' : ''}`}>
              <span className="flow-num">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Program mix" subtitle={`How your ${fmtNum(qr.total)} QR codes are assigned`}>
          {qr.total ? (
            <div className="bars">
              {MIX.map((m) => (
                <div key={m.key}>
                  <div className="bar-head"><span>{m.label}</span><b className="num">{fmtNum(qr[m.key])} · {pct(qr[m.key], qr.total)}%</b></div>
                  <Progress value={pct(qr[m.key], qr.total)} color={m.color} />
                </div>
              ))}
            </div>
          ) : <EmptyState icon="qr" title="No QR codes yet" text="Generate a batch to see how programs are distributed." />}
        </Card>

        <Card title="Recent campaigns" flush actions={<Link to="/campaigns" className="btn btn-ghost btn-sm">View all</Link>}>
          {recent.length
            ? <DataTable rows={recent} columns={RECENT_COLUMNS} />
            : <EmptyState icon="campaign" title="No campaigns yet" text="Create a product, then set up your first campaign." />}
        </Card>
      </div>
    </div>
  )
}
