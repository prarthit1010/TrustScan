const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const numFmt = new Intl.NumberFormat('en-IN')

// 'YYYY-MM-DD' strings are parsed as local dates so they don't shift a day
const toDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d))

export const fmtDate = (d) => (d ? dateFmt.format(toDate(d)) : '—')
export const fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—')
export const fmtMoney = (n) => moneyFmt.format(Number(n) || 0)
export const fmtNum = (n) => numFmt.format(n || 0)
export const today = () => new Date().toLocaleDateString('en-CA')
export const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0)

export const batchLabel = (b) => b.batch_name || b.name || `Batch #${b.batch_id || b.id}`

export const PROGRAMS = {
  verification: { label: 'Verification', tone: 'blue', icon: 'shieldCheck', text: 'Customers scan to confirm the product is genuine.' },
  cashback: { label: 'Cashback', tone: 'green', icon: 'gift', text: 'Each code unlocks a one-time cashback reward.' },
  both: { label: 'Verification + Cashback', tone: 'violet', icon: 'layers', text: 'Confirms authenticity, then rewards the customer.' },
}

export const CAMPAIGN_STATUS = {
  active: { label: 'Active', tone: 'green' },
  upcoming: { label: 'Upcoming', tone: 'blue' },
  ended: { label: 'Ended', tone: 'gray' },
}

export const VALIDITY = {
  live: { label: 'Live', tone: 'green' },
  not_active: { label: 'Not active yet', tone: 'amber' },
  expired: { label: 'Expired', tone: 'gray' },
  deleted: { label: 'Deleted', tone: 'red' },
}
