import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errMsg, useFetch } from '../api'
import { SelectField, TextField } from '../components/form'
import Icon from '../components/Icon'
import { CellTitle, TableCard } from '../components/table'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'
import { batchLabel, fmtDate, fmtMoney, fmtNum, PROGRAMS, VALIDITY } from '../format'

const PAGE_SIZES = [25, 50, 100, 200]
const DEFAULT_SIZE = 50
// The chosen rows-per-page is remembered in this browser
const savedSize = () => {
  const n = Number(localStorage.getItem('qrPageSize'))
  return PAGE_SIZES.includes(n) ? n : DEFAULT_SIZE
}
const FILTER_KEYS = ['campaign_id', 'batch_id', 'program', 'status', 'q']
const PROGRAM_FILTERS = [...Object.entries(PROGRAMS).map(([value, p]) => ({ value, label: p.label })), { value: 'none', label: 'Unassigned' }]
const STATUS_FILTERS = [
  { value: 'not_scanned', label: 'Not scanned' },
  { value: 'scanned', label: 'Scanned' },
  { value: 'redeemed', label: 'Cashback claimed' },
  { value: 'deleted', label: 'Deleted' },
]

function ProgramBadge({ program }) {
  if (!program) return <Badge tone="gray">Unassigned</Badge>
  return <Badge tone={PROGRAMS[program].tone}>{PROGRAMS[program].label}</Badge>
}

export default function QrDetails() {
  const [params, setParams] = useSearchParams()
  const { data: campaigns } = useFetch('/campaigns')
  const { data: batches } = useFetch('/batches')
  const [result, setResult] = useState(null)
  const [total, setTotal] = useState(null)
  const [error, setError] = useState('')
  const countedQuery = useRef(null) // filters the current total was counted for
  const [search, setSearch] = useState(params.get('q') || '')

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']))
  const page = Number(params.get('page')) || 1
  const after = params.get('after') || ''
  const before = params.get('before') || ''
  const limit = PAGE_SIZES.includes(Number(params.get('limit'))) ? Number(params.get('limit')) : savedSize()
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'campaign_id') next.delete('batch_id')
    next.delete('page')
    next.delete('after')
    next.delete('before')
    setParams(next, { replace: true })
  }

  // Next/Previous pass the QR ID at the edge of the current page as a cursor, so the server
  // never has to skip over earlier rows (fast on page 1 or page 10,000)
  // Changing rows-per-page goes back to page 1; the total stays the same so it isn't recounted
  const setPageSize = (size) => {
    localStorage.setItem('qrPageSize', size)
    const next = new URLSearchParams(params)
    for (const k of ['page', 'after', 'before']) next.delete(k)
    if (Number(size) === DEFAULT_SIZE) next.delete('limit')
    else next.set('limit', size)
    setParams(next, { replace: true })
  }

  const goTo = (nextPage, cursor = {}) => {
    const next = new URLSearchParams(params)
    for (const k of ['page', 'after', 'before']) next.delete(k)
    if (nextPage > 1) {
      next.set('page', String(nextPage))
      for (const [k, v] of Object.entries(cursor)) next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Debounce the code search so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { if (search !== filters.q) setFilter('q', search.trim()) }, 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    // Only count the total when the filters change, not on every Next/Previous click
    const needCount = countedQuery.current !== query
    if (needCount) setResult(null)
    const qs = new URLSearchParams(query)
    qs.set('limit', limit)
    if (after) qs.set('after', after)
    else if (before) qs.set('before', before)
    else qs.set('page', page)
    if (!needCount) qs.set('count', '0')
    api.get(`/qr-codes?${qs}`)
      .then((r) => {
        if (cancelled) return // ignore a slow response for filters the user already changed
        if (r.data.total != null) { setTotal(r.data.total); countedQuery.current = query }
        setResult(r.data)
        setError('')
      })
      .catch((e) => { if (!cancelled) setError(errMsg(e)) })
    return () => { cancelled = true }
  }, [query, page, after, before, limit])

  const batchFilters = (batches || [])
    .filter((b) => !filters.campaign_id || String(b.campaign_id) === filters.campaign_id)
    .map((b) => ({ value: String(b.id), label: batchLabel(b) }))
  const pages = total ? Math.max(Math.ceil(total / limit), 1) : 1
  const from = total ? (page - 1) * limit + 1 : 0
  const rows = result?.rows || []

  const columns = [
    { key: 'display_id', header: 'QR ID', className: 'qr-id nowrap' },
    { key: 'campaign', header: 'Campaign', render: (q) => <CellTitle title={q.campaign_name} sub={`${batchLabel(q)} · ${q.product_name}`} /> },
    { key: 'program', header: 'Program', render: (q) => <ProgramBadge program={q.program} /> },
    {
      key: 'cashback', header: 'Cashback', render: (q) => (q.cashback_amount != null ? <>
        <div className="nowrap">{fmtMoney(q.cashback_amount)}</div>
        {q.redeemed_at && <div className="cell-sub text-success">Claimed</div>}
      </> : <span className="subtle">—</span>),
    },
    {
      key: 'validity', header: 'Validity', render: (q) => <>
        <Badge tone={VALIDITY[q.validity].tone} dot>{VALIDITY[q.validity].label}</Badge>
        {q.deleted_at && <div className="cell-sub">{fmtDate(q.deleted_at)}</div>}
      </>,
    },
    {
      key: 'scan_count', header: 'Scan status', render: (q) => (q.scan_count > 0 ? <>
        <Badge tone="blue" dot>Scanned</Badge>
        <div className="cell-sub nowrap">{fmtDate(q.first_scanned_at)}{q.scan_count > 1 && ` · ${fmtNum(q.scan_count)} times`}</div>
      </> : <Badge tone="gray">Not scanned</Badge>),
    },
  ]

  const toolbar = (
    <div className="toolbar">
      <TextField className="toolbar-search" prefix={<Icon name="search" size={16} />} placeholder="Search by QR ID"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      <SelectField className="toolbar-filter" placeholder="All campaigns" value={filters.campaign_id}
        options={(campaigns || []).map((c) => ({ value: String(c.id), label: c.name }))} onChange={(e) => setFilter('campaign_id', e.target.value)} />
      <SelectField className="toolbar-filter" placeholder="All batches" value={filters.batch_id}
        options={batchFilters} onChange={(e) => setFilter('batch_id', e.target.value)} />
      <SelectField className="toolbar-filter" placeholder="All programs" value={filters.program}
        options={PROGRAM_FILTERS} onChange={(e) => setFilter('program', e.target.value)} />
      <SelectField className="toolbar-filter" placeholder="Any scan status" value={filters.status}
        options={STATUS_FILTERS} onChange={(e) => setFilter('status', e.target.value)} />
    </div>
  )

  const pager = result && (
    <div className="pager">
      <div className="row pager-size">
        <span>Showing {fmtNum(from)}–{fmtNum(from + rows.length - 1)} of {fmtNum(total)}</span>
        <label className="row">
          <span>Rows per page</span>
          <select className="select select-sm" value={limit} onChange={(e) => setPageSize(e.target.value)}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <Button variant="secondary" size="sm" disabled={page <= 1}
          onClick={() => goTo(page - 1, page - 1 > 1 ? { before: rows[0].display_id } : {})}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages || rows.length < limit}
          onClick={() => goTo(page + 1, { after: rows[rows.length - 1].display_id })}>Next</Button>
      </div>
    </div>
  )

  return (
    <>
      <PageHeader title="QR Details"
        subtitle="Every generated code with its program, cashback, validity and scan history."
        actions={<a className="btn btn-secondary" href={`/api/qr-codes/export?${query}`}><Icon name="download" size={16} />Export CSV</a>} />
      <TableCard toolbar={toolbar} columns={columns} rows={result?.rows ?? null} rowClass={(q) => q.deleted_at && 'row-deleted'} error={error} footer={pager}
        empty={<EmptyState icon="qr" title="No QR codes found" text={query ? 'Try changing the filters.' : 'Generate a batch to see codes here.'} />} />
    </>
  )
}
